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


if __name__ == "__main__":
    unittest.main()
