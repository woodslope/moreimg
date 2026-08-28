import errno
import gzip
import io
import json
import mimetypes
import os
import socket
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import lru_cache, partial
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request
from urllib.request import build_opener, ProxyHandler


UPSTREAMS = {
    "/v1/chat/completions": "https://mo.monond.com/v1/chat/completions",
    "/v1/images/generations": "https://api.aixoras.com/v1/images/generations",
}

PROXY_SUFFIXES = {
    "/proxy/text": ("/chat/completions", "/responses"),
    "/proxy/image": ("/images/generations",),
    "/proxy/models": ("/models",),
}

# 图片 CDN 多数不带 CORS 头，浏览器直连会在“上游已出图并计费”之后失败。
# 这条同源 GET 转发只用于把已生成的图片取回本地，不接受任何请求体。
IMAGE_ASSET_PROXY_PATH = "/proxy/image-asset"

# 必须大于前端的 IMAGE_REQUEST_TIMEOUT_MS（600 秒）：
# 两侧数值相同时谁先超时不确定，同一种故障会随机报成 504 或前端超时。
PROXY_TIMEOUT_SECONDS = 660


def detect_upstream_proxy():
    """优先使用显式配置，否则探测常见的本机 HTTP 代理端口。"""
    configured = (
        os.environ.get("MOREIMG_UPSTREAM_PROXY")
        or os.environ.get("HTTPS_PROXY")
        or os.environ.get("https_proxy")
        or os.environ.get("HTTP_PROXY")
        or os.environ.get("http_proxy")
    )
    if configured:
        return configured
    for port in (7897, 7890, 7891, 8080):
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.15):
                return f"http://127.0.0.1:{port}"
        except OSError:
            continue
    return ""


UPSTREAM_PROXY = detect_upstream_proxy()
DIRECT_OPENER = build_opener(ProxyHandler({}))
PROXY_OPENER = build_opener(ProxyHandler({"http": UPSTREAM_PROXY, "https": UPSTREAM_PROXY})) if UPSTREAM_PROXY else DIRECT_OPENER

# 只有“连接本机代理本身就失败”才说明请求根本没送出去，这时直连重试是安全的。
# 超时和连接中断都可能发生在上游已经受理之后：重试会重复提交、重复计费。
PRE_SUBMIT_ERRNOS = frozenset({errno.ECONNREFUSED, errno.EHOSTUNREACH, errno.ENETUNREACH, errno.EADDRNOTAVAIL})


def is_pre_submit_failure(error):
    reason = getattr(error, "reason", error)
    if isinstance(reason, socket.gaierror):
        return True
    if isinstance(reason, (TimeoutError, socket.timeout)):
        return False
    return isinstance(reason, OSError) and reason.errno in PRE_SUBMIT_ERRNOS

COMPRESSIBLE_SUFFIXES = {".css", ".html", ".js", ".json", ".svg", ".txt"}


@lru_cache(maxsize=32)
def read_gzip_file(file_path, modified_ns):
    del modified_ns
    return gzip.compress(Path(file_path).read_bytes(), compresslevel=6)


class MoreImgHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if self.command == "POST":
            cache_control = "no-store"
        elif parse_qs(parsed.query).get("v") and path not in ("/", "/index.html"):
            cache_control = "public, max-age=31536000, immutable"
        elif path in ("/", "/index.html", "/app.js"):
            cache_control = "no-cache"
        else:
            cache_control = "public, max-age=3600"
        self.send_header("Cache-Control", cache_control)
        super().end_headers()

    def send_head(self):
        request_path = urlparse(self.path).path
        file_path = Path(self.translate_path(request_path))
        accepts_gzip = "gzip" in self.headers.get("Accept-Encoding", "").lower()
        if (
            accepts_gzip
            and "Range" not in self.headers
            and file_path.is_file()
            and file_path.suffix.lower() in COMPRESSIBLE_SUFFIXES
            and file_path.stat().st_size >= 1024
        ):
            stat_result = file_path.stat()
            payload = read_gzip_file(str(file_path), stat_result.st_mtime_ns)
            self.send_response(200)
            self.send_header("Content-Type", mimetypes.guess_type(file_path.name)[0] or "application/octet-stream")
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Vary", "Accept-Encoding")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Last-Modified", self.date_time_string(stat_result.st_mtime))
            self.end_headers()
            return io.BytesIO(payload)
        return super().send_head()

    def resolve_upstream(self):
        if self.path in UPSTREAMS:
            return UPSTREAMS[self.path]

        allowed_suffixes = PROXY_SUFFIXES.get(self.path)
        if not allowed_suffixes:
            return None

        upstream = self.headers.get("X-MoreImg-Upstream", "").strip()
        parsed = urlparse(upstream)
        if parsed.scheme != "https" or not parsed.netloc or not parsed.path.rstrip("/").endswith(allowed_suffixes):
            return None
        return upstream

    def is_allowed_origin(self):
        # 无 Origin 头的请求（curl、测试脚本、同源表单）照旧放行；
        # 浏览器发起的跨站请求会带上 Origin，此时只接受本机页面自身。
        # 否则任意网站的 JS 都能借这台机器转发请求、消耗用户的 API 额度。
        origin = self.headers.get("Origin", "").strip()
        if not origin:
            return True
        host, port = self.server.server_address[:2]
        return origin in (f"http://{host}:{port}", f"http://localhost:{port}")

    def do_POST(self):
        if not self.is_allowed_origin():
            self.send_json_error(403, "Cross-origin proxy request rejected")
            return

        upstream = self.resolve_upstream()
        if not upstream:
            self.send_error(400, "Invalid or unsupported upstream")
            return

        body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        headers = {"Content-Type": "application/json"}
        authorization = self.headers.get("Authorization", "")
        if authorization:
            headers["Authorization"] = authorization

        request = Request(upstream, data=body, headers=headers, method="POST")
        try:
            response = self.open_upstream(request)
        except HTTPError as error:
            response = error
        except (TimeoutError, socket.timeout, URLError) as error:
            self.send_upstream_failure(error, "Upstream request timed out", "Upstream request failed")
            return

        self.stream_upstream(response, "application/json")

    def do_GET(self):
        if urlparse(self.path).path != IMAGE_ASSET_PROXY_PATH:
            super().do_GET()
            return
        if not self.is_allowed_origin():
            self.send_json_error(403, "Cross-origin proxy request rejected")
            return

        upstream = self.headers.get("X-MoreImg-Upstream", "").strip()
        parsed = urlparse(upstream)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            self.send_json_error(400, "Invalid or unsupported image URL")
            return

        # 只转发图片本体，不携带 Authorization：签名信息已经在 URL 里。
        try:
            response = self.open_upstream(Request(upstream, method="GET"))
        except HTTPError as error:
            response = error
        except (TimeoutError, socket.timeout, URLError) as error:
            self.send_upstream_failure(error, "Image download timed out", "Image download failed")
            return

        self.stream_upstream(response, "application/octet-stream")

    def send_upstream_failure(self, error, timeout_message, failure_message):
        # URLError 常把真实超时包在 reason 里；不解包就会把 504 误报成 502，
        # 前端也就无法区分“上游可能已受理并计费”和“根本没连上”。
        reason = getattr(error, "reason", error)
        if isinstance(error, (TimeoutError, socket.timeout)) or isinstance(reason, (TimeoutError, socket.timeout)):
            self.send_json_error(504, timeout_message, str(reason))
            return
        self.send_json_error(502, failure_message, str(reason))

    def stream_upstream(self, response, default_content_type):
        with response:
            self.send_response(response.status)
            self.send_header("Content-Type", response.headers.get("Content-Type", default_content_type))
            self.end_headers()
            try:
                while True:
                    chunk = response.read1(64 * 1024)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass

    def open_upstream(self, request):
        # ProxyHandler 会就地把 Request 的 host 改写成代理地址，重试必须基于原始参数
        # 重建请求，否则“直连回退”会去连代理端口本身，真实上游状态码全部退化成 502。
        upstream_url = request.full_url
        upstream_data = request.data
        upstream_headers = dict(request.header_items())
        upstream_method = request.get_method()

        def rebuild():
            return Request(upstream_url, data=upstream_data, headers=upstream_headers, method=upstream_method)

        # 测试夹具和本机目标必须直连，避免把回环请求错误地送入代理。
        hostname = (urlparse(upstream_url).hostname or "").lower()
        if hostname in {"127.0.0.1", "localhost", "::1"} or PROXY_OPENER is DIRECT_OPENER:
            return DIRECT_OPENER.open(request, timeout=PROXY_TIMEOUT_SECONDS)

        try:
            return PROXY_OPENER.open(rebuild(), timeout=PROXY_TIMEOUT_SECONDS)
        except HTTPError:
            # 上游已经受理并给出了状态码：重试只会重复提交、重复计费，
            # 还会把真实状态码和上游提示替换成 502。必须原样上抛。
            raise
        except (URLError, TimeoutError, socket.timeout) as error:
            if not is_pre_submit_failure(error):
                raise
            # 只有“请求还没送到上游”的连接故障才回退直连。
            return DIRECT_OPENER.open(rebuild(), timeout=PROXY_TIMEOUT_SECONDS)

    def send_json_error(self, status, message, detail=""):
        payload = json.dumps({"message": message, "detail": detail}, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


if __name__ == "__main__":
    directory = Path(__file__).resolve().parent
    handler = partial(MoreImgHandler, directory=str(directory))
    port = int(os.environ.get("MOREIMG_PORT", "4187"))
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    print(f"MoreImg local: http://127.0.0.1:{port}/")
    server.serve_forever()
