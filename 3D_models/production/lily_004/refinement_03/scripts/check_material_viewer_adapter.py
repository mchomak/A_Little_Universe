"""Read-only HTTP readiness and asset-hash check for the local viewer adapter."""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

from material_viewer_adapter import (
    ADAPTER_REPORT,
    GLB_PATH,
    MATERIAL_REPORT,
    THREE_PREFIX,
    VIEWER_JS_PATH,
    VIEWER_PATH,
)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def request(opener, url: str, method: str = "GET") -> tuple[int, dict[str, str], bytes]:
    req = urllib.request.Request(url, method=method)
    try:
        response = opener.open(req, timeout=8)
    except urllib.error.HTTPError as error:
        try:
            return error.code, dict(error.headers.items()), error.read()
        finally:
            error.close()
    with response:
        return response.status, dict(response.headers.items()), response.read()


def run_readiness(base_url: str, adapter_report: dict) -> dict:
    parsed = urlsplit(base_url)
    expected_port = int(adapter_report["server"]["port"])
    if parsed.scheme != "http" or parsed.hostname != "127.0.0.1" or parsed.port != expected_port or parsed.path not in ("", "/"):
        raise ValueError(f"--base-url must target http://127.0.0.1:{expected_port}")
    base = f"http://127.0.0.1:{expected_port}"
    opener = urllib.request.build_opener(NoRedirect())
    checks: list[dict] = []

    def expect(name: str, route: str, status: int, *, method: str = "GET", expected_sha: str | None = None, expected_bytes: bytes | None = None, expected_location: str | None = None, expected_length: int | None = None, reject_listing: bool = False) -> bytes:
        actual_status, headers, body = request(opener, base + route, method)
        if actual_status != status:
            raise RuntimeError(f"{name}: expected HTTP {status}, got {actual_status}")
        if expected_location is not None and headers.get("Location") != expected_location:
            raise RuntimeError(f"{name}: redirect target mismatch: {headers.get('Location')}")
        if expected_length is not None and int(headers.get("Content-Length", "-1")) != expected_length:
            raise RuntimeError(f"{name}: Content-Length mismatch")
        digest = sha256(body) if body else None
        if expected_sha is not None and digest != expected_sha:
            raise RuntimeError(f"{name}: SHA-256 mismatch: {digest}")
        if expected_bytes is not None and body != expected_bytes:
            raise RuntimeError(f"{name}: response is not byte-identical to the stored viewer copy")
        if reject_listing and b"Directory listing" in body:
            raise RuntimeError(f"{name}: directory listing leaked")
        checks.append({"name": name, "route": route, "method": method, "status": actual_status, "bytes": len(body), "sha256": digest})
        return body

    viewer_copies = {item["role"]: item for item in adapter_report["viewerCopies"]}
    html_copy = Path(viewer_copies["viewerHtml"]["copyPath"]).read_bytes()
    js_copy = Path(viewer_copies["viewerJs"]["copyPath"]).read_bytes()
    expect("viewer html", VIEWER_PATH, 200, expected_sha=viewer_copies["viewerHtml"]["copySha256"], expected_bytes=html_copy)
    expect("viewer js", VIEWER_JS_PATH, 200, expected_sha=viewer_copies["viewerJs"]["copySha256"], expected_bytes=js_copy)
    expect("page query route", VIEWER_PATH + "?asset=final", 200, expected_bytes=html_copy)
    expect("root redirect", "/", 302, expected_location=VIEWER_PATH + "?asset=final")
    asset_body = expect("GLB override", GLB_PATH, 200, expected_sha=adapter_report["asset"]["sha256"])
    expect("GLB HEAD", GLB_PATH, 200, method="HEAD", expected_length=len(asset_body))

    for relative_path, expected_sha in adapter_report["three"]["verifiedEntryFileSha256"].items():
        expect("Three.js " + relative_path, THREE_PREFIX + relative_path, 200, expected_sha=expected_sha)

    for name, route, status in (
        ("three directory listing", THREE_PREFIX, 404),
        ("unknown route", "/not-allowlisted", 404),
        ("encoded traversal", THREE_PREFIX + "%2e%2e/%2e%2e/secrets.txt", 400),
    ):
        expect(name, route, status, reject_listing=True)
    post_status, _, post_body = request(opener, base + VIEWER_PATH, "POST")
    if post_status != 405 or b"Directory listing" in post_body:
        raise RuntimeError(f"POST must be rejected without exposing paths, got HTTP {post_status}")
    checks.append({"name": "write method rejected", "route": VIEWER_PATH, "method": "POST", "status": post_status, "bytes": len(post_body)})
    return {
        "result": "PASS",
        "baseUrl": base,
        "checks": checks,
        "checkCount": len(checks),
        "writesIssued": False,
        "browserLaunched": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True, help="must be the adapter's 127.0.0.1 URL")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None)
    try:
        adapter_report = json.loads(ADAPTER_REPORT.read_text(encoding="utf-8"))
        readiness = run_readiness(args.base_url, adapter_report)
        adapter_report["httpReadiness"] = readiness
        ADAPTER_REPORT.write_text(json.dumps(adapter_report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        material_report = json.loads(MATERIAL_REPORT.read_text(encoding="utf-8"))
        material_report["viewerAdapter"] = adapter_report
        MATERIAL_REPORT.write_text(json.dumps(material_report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    except (OSError, ValueError, KeyError, json.JSONDecodeError, RuntimeError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1
    print(f"PASS: HTTP readiness; {readiness['checkCount']} read-only route checks")
    print(f"REPORT {ADAPTER_REPORT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
