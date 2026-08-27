import http.client
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


if __name__ == "__main__":
    unittest.main()
