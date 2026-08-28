import http.client
import json
import select
import socket
import sys
import threading
import time
import unittest
from functools import partial
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PROJECT_DIRECTORY = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_DIRECTORY))

import server as moreimg_server

ORIGINAL_URLPARSE = moreimg_server.urlparse
# 端口 9（discard）在本机必然连不通，用来模拟“本机 HTTP 代理已失效”。
UNREACHABLE_PROXY = "http://127.0.0.1:9"


class StreamingUpstreamHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        self.wfile.write(b"data: first\n\n")
        self.wfile.flush()
        time.sleep(0.35)
        self.wfile.write(b"data: second\n\n")
        self.wfile.flush()

    def do_GET(self):
        # 模拟图片 CDN：只回图片本体，且刻意不带 CORS 头——浏览器直连会失败，
        # 所以必须由本机代理取回，否则“已计费”的图片拿不到。
        self.send_response(200)
        self.send_header("Content-Type", "image/png")
        self.end_headers()
        self.wfile.write(b"fake-png-bytes")

    def log_message(self, format, *args):
        pass


class ServerPerformanceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.upstream = ThreadingHTTPServer(("127.0.0.1", 0), StreamingUpstreamHandler)
        cls.upstream_thread = threading.Thread(target=cls.upstream.serve_forever, daemon=True)
        cls.upstream_thread.start()

        cls.original_upstream = moreimg_server.UPSTREAMS["/v1/chat/completions"]
        moreimg_server.UPSTREAMS["/v1/chat/completions"] = (
            f"http://127.0.0.1:{cls.upstream.server_port}/v1/chat/completions"
        )
        directory = str(PROJECT_DIRECTORY)
        handler = partial(moreimg_server.MoreImgHandler, directory=directory)
        cls.proxy = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        cls.proxy_thread = threading.Thread(target=cls.proxy.serve_forever, daemon=True)
        cls.proxy_thread.start()

    @classmethod
    def tearDownClass(cls):
        moreimg_server.UPSTREAMS["/v1/chat/completions"] = cls.original_upstream
        cls.proxy.shutdown()
        cls.upstream.shutdown()

    def request(self, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.proxy.server_port, timeout=2)
        request_headers = {"Content-Type": "application/json", **(headers or {})}
        connection.request(method, path, body=body, headers=request_headers)
        return connection, connection.getresponse()

    def test_text_proxy_forwards_first_chunk_before_upstream_finishes(self):
        started_at = time.monotonic()
        connection, response = self.request("POST", "/v1/chat/completions", b"{}")
        first_event = response.readline()
        elapsed = time.monotonic() - started_at
        connection.close()

        self.assertEqual(response.status, 200)
        self.assertEqual(response.getheader("Cache-Control"), "no-store")
        self.assertEqual(first_event, b"data: first\n")
        self.assertLess(elapsed, 0.2)

    def test_app_shell_revalidates_but_versioned_assets_are_immutable(self):
        app_connection, app_response = self.request("GET", "/app.js")
        app_response.read()
        asset_connection, asset_response = self.request(
            "GET", "/app.js?v=test", headers={"Accept-Encoding": "gzip"}
        )
        compressed_body = asset_response.read()
        html_connection, html_response = self.request("GET", "/")
        html_response.read()

        self.assertEqual(app_response.getheader("Cache-Control"), "no-cache")
        self.assertEqual(asset_response.getheader("Cache-Control"), "public, max-age=31536000, immutable")
        self.assertEqual(asset_response.getheader("Content-Encoding"), "gzip")
        self.assertEqual(asset_response.getheader("Vary"), "Accept-Encoding")
        self.assertLess(len(compressed_body), int(app_response.getheader("Content-Length")))
        self.assertEqual(html_response.getheader("Cache-Control"), "no-cache")
        app_connection.close()
        asset_connection.close()
        html_connection.close()

    def test_cross_site_origin_cannot_borrow_the_proxy(self):
        # 任意网站的 JS 都能向本机代理发 POST；它读不到响应，但能烧掉用户的 API 额度。
        # 带跨站 Origin 必须在转发前被拒，且不能触及上游。
        blocked_connection, blocked_response = self.request(
            "POST", "/v1/chat/completions", b"{}", headers={"Origin": "https://evil.example"}
        )
        blocked_body = blocked_response.read()
        blocked_connection.close()

        # 页面自身的同源请求与无 Origin 的脚本请求都必须照旧放行。
        same_origin_connection, same_origin_response = self.request(
            "POST", "/v1/chat/completions", b"{}",
            headers={"Origin": f"http://127.0.0.1:{self.proxy.server_port}"}
        )
        same_origin_first_event = same_origin_response.readline()
        same_origin_connection.close()

        self.assertEqual(blocked_response.status, 403)
        self.assertIn(b"Cross-origin", blocked_body)
        self.assertEqual(same_origin_response.status, 200)
        self.assertEqual(same_origin_first_event, b"data: first\n")

    def test_image_asset_proxy_fetches_generated_images_same_origin(self):
        # 图片 CDN 多数不带 CORS 头，浏览器直连会在上游已出图并计费之后失败。
        # 这条同源 GET 转发把图片取回本地，避免付了钱却拿不到图。
        image_url = f"http://127.0.0.1:{self.upstream.server_port}/generated/card.png"
        connection, response = self.request(
            "GET", moreimg_server.IMAGE_ASSET_PROXY_PATH, headers={"X-MoreImg-Upstream": image_url}
        )
        body = response.read()
        connection.close()

        self.assertEqual(response.status, 200)
        self.assertEqual(response.getheader("Content-Type"), "image/png")
        self.assertEqual(body, b"fake-png-bytes")

    def test_image_asset_proxy_rejects_non_http_targets(self):
        # 缺少协议校验时，这个转发会变成读取本机文件的通道。
        connection, response = self.request(
            "GET", moreimg_server.IMAGE_ASSET_PROXY_PATH, headers={"X-MoreImg-Upstream": "file:///etc/passwd"}
        )
        body = response.read()
        connection.close()

        self.assertEqual(response.status, 400)
        self.assertIn(b"Invalid", body)

    def test_proxy_timeout_outlives_the_browser_timeout(self):
        # 两侧超时数值相同时谁先触发不确定，同一种故障会随机报成 504 或前端超时。
        # 代理必须比前端的 600 秒更长，才能让浏览器拿到真实状态码。
        self.assertGreater(moreimg_server.PROXY_TIMEOUT_SECONDS, 600)


class UpstreamRetryTest(unittest.TestCase):
    """上游已受理的请求绝不能被重发：中转站会重复计费，真实状态码也会被 502 掩盖。"""

    @classmethod
    def setUpClass(cls):
        cls.submissions = []

        class CountingUpstream(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def do_POST(self):
                length = int(self.headers.get("Content-Length", "0"))
                self.rfile.read(length)
                cls.submissions.append(time.monotonic())
                body = b'{"error":{"message":"relay quota exceeded"}}'
                self.send_response(429)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, format, *args):
                pass

        cls.upstream = ThreadingHTTPServer(("127.0.0.1", 0), CountingUpstream)
        threading.Thread(target=cls.upstream.serve_forever, daemon=True).start()

        cls.original_proxy_opener = moreimg_server.PROXY_OPENER
        cls.original_upstream = moreimg_server.UPSTREAMS["/v1/chat/completions"]
        moreimg_server.UPSTREAMS["/v1/chat/completions"] = (
            f"http://127.0.0.1:{cls.upstream.server_port}/v1/chat/completions"
        )

        handler = partial(moreimg_server.MoreImgHandler, directory=str(PROJECT_DIRECTORY))
        cls.proxy = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=cls.proxy.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        moreimg_server.UPSTREAMS["/v1/chat/completions"] = cls.original_upstream
        moreimg_server.PROXY_OPENER = cls.original_proxy_opener
        moreimg_server.urlparse = ORIGINAL_URLPARSE
        cls.proxy.shutdown()
        cls.upstream.shutdown()

    def setUp(self):
        type(self).submissions.clear()
        moreimg_server.PROXY_OPENER = self.original_proxy_opener
        moreimg_server.urlparse = ORIGINAL_URLPARSE

    def use_unreachable_proxy(self):
        moreimg_server.PROXY_OPENER = moreimg_server.build_opener(
            moreimg_server.ProxyHandler({"http": UNREACHABLE_PROXY, "https": UNREACHABLE_PROXY})
        )

    def force_proxy_branch(self):
        """把回环上游伪装成外网主机，使 open_upstream 走 PROXY_OPENER 分支。"""
        loopback_hosts = {"127.0.0.1", "localhost", "::1"}

        def external_urlparse(url, *args, **kwargs):
            parsed = ORIGINAL_URLPARSE(url, *args, **kwargs)
            if parsed.hostname in loopback_hosts:
                return parsed._replace(netloc="relay.example.invalid")
            return parsed

        moreimg_server.urlparse = external_urlparse

    def post(self):
        connection = http.client.HTTPConnection("127.0.0.1", self.proxy.server_port, timeout=20)
        connection.request(
            "POST", "/v1/chat/completions", body=b"{}", headers={"Content-Type": "application/json"}
        )
        response = connection.getresponse()
        body = response.read()
        connection.close()
        return response, body

    def test_upstream_http_error_is_forwarded_without_resubmitting(self):
        # 旧实现把 HTTPError 当成传输故障重试：中转站收到两次提交，
        # 浏览器却只看到一次“502 Upstream request failed”。
        self.use_unreachable_proxy()
        self.force_proxy_branch()

        response, body = self.post()

        self.assertEqual(len(self.submissions), 1, "上游只应收到一次提交")
        self.assertEqual(response.status, 429, "必须原样透传上游状态码，而不是退化成 502")
        self.assertIn(b"relay quota exceeded", body)

    def test_unreachable_proxy_falls_back_to_a_rebuilt_direct_request(self):
        # ProxyHandler 会就地改写 Request.host；沿用同一个对象重试会连到代理端口本身，
        # 于是“代理不可用”永远变成 502，而不是直连成功。
        self.use_unreachable_proxy()
        self.force_proxy_branch()

        response, body = self.post()

        self.assertEqual(len(self.submissions), 1, "直连回退只应提交一次")
        self.assertEqual(response.status, 429, "直连回退必须真正到达上游，而不是再次连到代理端口")
        self.assertIn(b"relay quota exceeded", body)

    def test_timeout_is_reported_as_504_with_its_reason(self):
        # URLError 常把真实超时包在 reason 里；不解包就会把 504 误报成 502。
        class TimingOutOpener:
            def open(self, request, timeout=None):
                raise moreimg_server.URLError(TimeoutError("timed out"))

        moreimg_server.PROXY_OPENER = TimingOutOpener()
        self.force_proxy_branch()

        response, body = self.post()

        self.assertEqual(len(self.submissions), 0)
        self.assertEqual(response.status, 504, "超时必须报 504，让前端提示用户核对计费")
        self.assertIn(b"timed out", body)


# ── 模拟“中转站前置 nginx 读超时”的最小夹具 ──────────────────────────────
# nginx 的 proxy_read_timeout 只被“又收到一个字节”重置，不看请求总耗时。
# 非流式请求在模型算完前完全静默，静默一旦超过阈值连接就被掐断；
# 流式请求持续吐分片，每一片都把计时器推后，所以能活到最后。
GATEWAY_READ_TIMEOUT_SECONDS = 0.5
MODEL_THINKING_SECONDS = 1.5
STREAM_CHUNK_INTERVAL_SECONDS = 0.15

GATEWAY_TIMEOUT_BODY = b"<html><head><title>504 Gateway Time-out</title></head><body>504 Gateway Time-out</body></html>"
GATEWAY_TIMEOUT_RESPONSE = (
    b"HTTP/1.1 504 Gateway Time-out\r\nContent-Type: text/html\r\nContent-Length: "
    + str(len(GATEWAY_TIMEOUT_BODY)).encode()
    + b"\r\nConnection: close\r\n\r\n"
    + GATEWAY_TIMEOUT_BODY
)


def read_http_message(connection):
    """读完一个完整的 HTTP 报文（头 + Content-Length 指定的正文）。"""
    buffered = b""
    while b"\r\n\r\n" not in buffered:
        chunk = connection.recv(4096)
        if not chunk:
            return b"", b""
        buffered += chunk
    head, _, body = buffered.partition(b"\r\n\r\n")
    length = 0
    for line in head.split(b"\r\n")[1:]:
        name, _, value = line.partition(b":")
        if name.strip().lower() == b"content-length":
            length = int(value.strip() or b"0")
    while len(body) < length:
        chunk = connection.recv(min(4096, length - len(body)))
        if not chunk:
            break
        body += chunk
    return head + b"\r\n\r\n", body


class RawSocketServer:
    """线程化裸 socket 服务：这些用例要精确控制“第一个字节什么时候写出”。"""

    def __init__(self, handle_connection):
        self.handle_connection = handle_connection
        self.socket = socket.socket()
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.socket.bind(("127.0.0.1", 0))
        self.socket.listen(8)
        self.port = self.socket.getsockname()[1]
        self.running = True
        threading.Thread(target=self.serve, daemon=True).start()

    def serve(self):
        while self.running:
            try:
                connection, _ = self.socket.accept()
            except OSError:
                return
            threading.Thread(target=self.guarded_handle, args=(connection,), daemon=True).start()

    def guarded_handle(self, connection):
        try:
            self.handle_connection(connection)
        except OSError:
            pass
        finally:
            connection.close()

    def shutdown(self):
        self.running = False
        self.socket.close()


class GatewayReadTimeoutTest(unittest.TestCase):
    """模拟中转站前置 nginx 的 proxy_read_timeout：
    非流式请求在静默期被掐断（模型仍算完并计费），流式请求靠分片续命活到 [DONE]。
    """

    @classmethod
    def setUpClass(cls):
        cls.billed = []
        cls.gateway_cutoffs = []

        cls.model = RawSocketServer(cls.serve_model)
        cls.gateway = RawSocketServer(cls.relay_with_read_timeout)

        cls.original_upstream = moreimg_server.UPSTREAMS["/v1/chat/completions"]
        moreimg_server.UPSTREAMS["/v1/chat/completions"] = (
            f"http://127.0.0.1:{cls.gateway.port}/v1/chat/completions"
        )
        handler = partial(moreimg_server.MoreImgHandler, directory=str(PROJECT_DIRECTORY))
        cls.proxy = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=cls.proxy.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        moreimg_server.UPSTREAMS["/v1/chat/completions"] = cls.original_upstream
        cls.proxy.shutdown()
        cls.gateway.shutdown()
        cls.model.shutdown()

    def setUp(self):
        type(self).billed.clear()
        type(self).gateway_cutoffs.clear()

    # ── 上游模型：唯一的区别是“算的过程中有没有字节流出” ────────────────
    @classmethod
    def serve_model(cls, connection):
        _, body = read_http_message(connection)
        if not body:
            return
        wants_stream = bool(json.loads(body or b"{}").get("stream"))
        payload = '{"schema_version":"moreimg-1.0"}'

        if wants_stream:
            cls.send_streamed_answer(connection, payload)
        else:
            cls.send_silent_answer(connection, payload)

    @classmethod
    def send_streamed_answer(cls, connection, payload):
        """流式：每 0.15 秒吐一片，每一片都把网关读超时计时器推后。"""
        connection.sendall(
            b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nConnection: close\r\n\r\n"
        )
        deadline = time.monotonic() + MODEL_THINKING_SECONDS
        while time.monotonic() < deadline:
            connection.sendall(b": keep-alive\n\n")
            time.sleep(STREAM_CHUNK_INTERVAL_SECONDS)
        for piece in (payload[:18], payload[18:]):
            event = json.dumps({"choices": [{"delta": {"content": piece}, "finish_reason": None}]})
            connection.sendall(f"data: {event}\n\n".encode())
        done = json.dumps({"choices": [{"delta": {}, "finish_reason": "stop"}]})
        connection.sendall(f"data: {done}\n\ndata: [DONE]\n\n".encode())
        cls.billed.append("stream")

    @classmethod
    def send_silent_answer(cls, connection, payload):
        """非流式：算完之前一个字节都不写；算完照样计费，哪怕没人还在听。"""
        time.sleep(MODEL_THINKING_SECONDS)
        cls.billed.append("non-stream")
        body = json.dumps({"choices": [{"message": {"content": payload}, "finish_reason": "stop"}]}).encode()
        try:
            connection.sendall(
                b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: "
                + str(len(body)).encode()
                + b"\r\nConnection: close\r\n\r\n"
                + body
            )
        except OSError:
            # 网关早已掐断并关闭了这条连接：钱花了，字节没人收。
            pass


    # ── 网关：转发请求，然后按“距离上一个字节的间隔”掐断 ────────────────
    @classmethod
    def relay_with_read_timeout(cls, downstream):
        head, body = read_http_message(downstream)
        if not head:
            return

        upstream = socket.create_connection(("127.0.0.1", cls.model.port), timeout=5)
        try:
            upstream.sendall(head + body)
            cls.pump_until_silent(downstream, upstream)
        finally:
            upstream.close()

    @classmethod
    def pump_until_silent(cls, downstream, upstream):
        """nginx 语义：proxy_read_timeout 计的是“两个字节之间的间隔”，
        不是请求总耗时。每收到数据就重置计时器，静默超阈值即 504 掐断。
        """
        while True:
            readable, _, _ = select.select([upstream], [], [], GATEWAY_READ_TIMEOUT_SECONDS)
            if not readable:
                cls.gateway_cutoffs.append(time.monotonic())
                try:
                    downstream.sendall(GATEWAY_TIMEOUT_RESPONSE)
                except OSError:
                    pass
                return
            chunk = upstream.recv(65536)
            if not chunk:
                return
            downstream.sendall(chunk)


    # ── 用例 ────────────────────────────────────────────────────────────
    def post(self, stream):
        connection = http.client.HTTPConnection("127.0.0.1", self.proxy.server_port, timeout=20)
        connection.request(
            "POST",
            "/v1/chat/completions",
            body=json.dumps({"stream": stream}).encode(),
            headers={"Content-Type": "application/json"},
        )
        response = connection.getresponse()
        payload = response.read()
        connection.close()
        return response, payload

    def test_non_stream_request_is_cut_off_by_the_gateway_after_it_was_billed(self):
        # 静默期（1.5 秒）远超网关读超时（0.5 秒）：连接先断，模型后算完。
        # 钱已经花掉，页面只拿到一个 504 HTML——这就是"后台有提交记录、前端没结果"。
        response, payload = self.post(stream=False)

        self.assertEqual(response.status, 504, "非流式静默期必须被网关掐断成 504")
        self.assertIn(b"Gateway Time-out", payload)
        self.assertEqual(len(self.gateway_cutoffs), 1, "网关应掐断且只掐断一次")

        # 关键：掐断之后上游仍然算完并计费，说明这次故障不能靠重试解决。
        time.sleep(MODEL_THINKING_SECONDS)
        self.assertEqual(self.billed, ["non-stream"], "上游在连接断开后照样算完并计费")

    def test_stream_request_survives_the_same_gateway_timeout(self):
        # 同一个网关、同一个 1.5 秒思考时长，唯一变化是 stream: true。
        # 分片间隔（0.15 秒）小于读超时（0.5 秒），计时器被反复推后，请求活到 [DONE]。
        started_at = time.monotonic()
        response, payload = self.post(stream=True)
        elapsed = time.monotonic() - started_at

        self.assertEqual(response.status, 200, "流式请求必须活过网关读超时")
        self.assertEqual(self.gateway_cutoffs, [], "有持续分片时网关不应掐断")
        self.assertEqual(self.billed, ["stream"])
        self.assertIn(b"data: [DONE]", payload, "必须收到完成标记，页面才敢解析结果")
        self.assertIn(b"moreimg-1.0", payload, "分片拼起来应是完整的 moreimg-1.0 正文")
        self.assertGreater(
            elapsed,
            GATEWAY_READ_TIMEOUT_SECONDS * 2,
            "本用例必须真的跨过读超时窗口，否则证明不了任何事",
        )


if __name__ == "__main__":
    unittest.main()
