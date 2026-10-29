from __future__ import annotations

import http.client
import hashlib
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from types import SimpleNamespace
from unittest.mock import patch

import material_viewer_adapter as adapter
from pathlib import Path

from material_viewer_adapter import (
    GLB_PATH,
    THREE_PREFIX,
    VIEWER_JS_PATH,
    VIEWER_PATH,
    file_sha256,
    make_handler,
    resolve_route,
)
from check_material_viewer_adapter import run_readiness


class MaterialViewerAdapterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.asset = self.root / "study.glb"
        self.asset.write_bytes(b"glb-test")
        self.viewer_html = self.root / "viewer.html"
        self.viewer_html.write_bytes(b"stock-html")
        self.viewer_js = self.root / "viewer.js"
        self.viewer_js.write_bytes(b"stock-js")
        self.three_root = self.root / "three"
        module = self.three_root / "build/three.module.js"
        module.parent.mkdir(parents=True)
        module.write_bytes(b"three-module")

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def route(self, path: str):
        return resolve_route(
            path,
            asset=self.asset,
            three_root=self.three_root.resolve(),
            viewer_html=self.viewer_html,
            viewer_js=self.viewer_js,
        )

    def test_exact_viewer_asset_and_installed_three_routes(self) -> None:
        self.assertEqual(self.route(VIEWER_PATH).file_path, self.viewer_html)
        self.assertEqual(self.route(VIEWER_JS_PATH).file_path, self.viewer_js)
        self.assertEqual(self.route(GLB_PATH).file_path, self.asset)
        self.assertEqual(
            self.route(THREE_PREFIX + "build/three.module.js").file_path,
            self.three_root / "build/three.module.js",
        )
        self.assertEqual(self.route(VIEWER_PATH + "?asset=final").status, 200)

    def test_unknown_and_traversal_routes_are_rejected_without_listing(self) -> None:
        self.assertEqual(self.route("/unknown").status, 404)
        self.assertEqual(self.route(THREE_PREFIX).status, 404)
        self.assertEqual(self.route(THREE_PREFIX + "%2e%2e/%2e%2e/secrets.txt").status, 400)
        self.assertEqual(self.route("/export/%2e%2e/secrets.txt").status, 400)
        self.assertEqual(self.route("/frontend/node_modules/three/%5c..%5csecret").status, 400)

    def test_root_redirect_and_http_method_allowlist(self) -> None:
        root = self.route("/")
        self.assertEqual(root.status, 302)
        self.assertEqual(root.location, VIEWER_PATH + "?asset=final")
        server = ThreadingHTTPServer(
            ("127.0.0.1", 0),
            make_handler(self.asset, self.three_root.resolve(), self.viewer_html, self.viewer_js),
        )
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=2)
            connection.request("GET", VIEWER_PATH)
            response = connection.getresponse()
            self.assertEqual(response.status, 200)
            self.assertEqual(response.read(), b"stock-html")
            connection.request("HEAD", GLB_PATH)
            response = connection.getresponse()
            self.assertEqual(response.status, 200)
            self.assertEqual(response.getheader("Content-Length"), str(len(b"glb-test")))
            self.assertEqual(response.read(), b"")
            connection.request("POST", VIEWER_PATH)
            response = connection.getresponse()
            self.assertEqual(response.status, 405)
            response_body = response.read()
            self.assertNotIn(b"Directory listing", response_body)
            connection.close()
            adapter_report = {
                "server": {"port": server.server_port},
                "viewerCopies": [
                    {"role": "viewerHtml", "copyPath": str(self.viewer_html), "copySha256": file_sha256(self.viewer_html)},
                    {"role": "viewerJs", "copyPath": str(self.viewer_js), "copySha256": file_sha256(self.viewer_js)},
                ],
                "asset": {"sha256": hashlib.sha256(self.asset.read_bytes()).hexdigest()},
                "three": {"verifiedEntryFileSha256": {"build/three.module.js": file_sha256(self.three_root / "build/three.module.js")}},
            }
            readiness = run_readiness(f"http://127.0.0.1:{server.server_port}", adapter_report)
            self.assertEqual(readiness["result"], "PASS")
            self.assertEqual(readiness["checkCount"], 11)
            self.assertFalse(readiness["writesIssued"])
            self.assertFalse(readiness["browserLaunched"])
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

    def test_production_startup_binds_loopback_address(self) -> None:
        observed = {}
        server_args = SimpleNamespace(asset=self.asset, three_root=self.three_root, port=0, check_only=False)
        fake_config = {"routeChecks": [], "server": {"url": "http://127.0.0.1:0", "port": 0}}

        class ObservedServer(ThreadingHTTPServer):
            def serve_forever(self, *args, **kwargs):
                observed["boundHost"] = self.server_address[0]
                observed["boundPort"] = self.server_address[1]
                worker = threading.Thread(target=super().serve_forever, args=args, kwargs=kwargs, daemon=True)
                worker.start()
                try:
                    connection = http.client.HTTPConnection("127.0.0.1", self.server_address[1], timeout=2)
                    connection.request("GET", GLB_PATH)
                    response = connection.getresponse()
                    observed["responseStatus"] = response.status
                    observed["responseBody"] = response.read()
                    connection.close()
                finally:
                    self.shutdown()
                    worker.join(timeout=2)
                    self.server_close()

        with (
            patch.object(adapter, "parse_args", return_value=server_args),
            patch.object(adapter, "verify_inputs", return_value=fake_config),
            patch.object(adapter, "write_reports"),
            patch.object(adapter, "ThreadingHTTPServer", ObservedServer),
        ):
            self.assertEqual(adapter.main(), 0)

        self.assertEqual(observed["boundHost"], "127.0.0.1")
        self.assertGreater(observed["boundPort"], 0)
        self.assertEqual(observed["responseStatus"], 200)
        self.assertEqual(observed["responseBody"], b"glb-test")


if __name__ == "__main__":
    unittest.main()
