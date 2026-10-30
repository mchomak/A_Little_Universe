"""Serve the byte-identical stock lily viewer with a single local GLB override."""
from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import sys
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

REFINEMENT_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = REFINEMENT_ROOT.parents[3]
HOST = "127.0.0.1"
VIEWER_PATH = "/scripts/viewer.html"
VIEWER_JS_PATH = "/scripts/viewer.js"
GLB_PATH = "/export/lily_004_animated.glb"
THREE_PREFIX = "/frontend/node_modules/three/"
REDIRECT_LOCATION = f"{VIEWER_PATH}?asset=final"
ASSET_COPY_DIR = Path(__file__).resolve().parent / "material_viewer_assets"
SOURCE_VIEWER_HTML = REPO_ROOT / "3D_models/production/lily_004/scripts/viewer.html"
SOURCE_VIEWER_JS = REPO_ROOT / "3D_models/production/lily_004/scripts/viewer.js"
MATERIAL_REPORT = REFINEMENT_ROOT / "reports/material_material_study.json"
ADAPTER_REPORT = REFINEMENT_ROOT / "reports/material_viewer_adapter.json"


@dataclass(frozen=True)
class Route:
    status: int
    file_path: Path | None = None
    content_type: str | None = None
    location: str | None = None


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _safe_three_file(request_path: str, three_root: Path) -> Path | None:
    relative = request_path[len(THREE_PREFIX):]
    if not relative or any(part in ("", ".", "..") for part in relative.split("/")):
        return None
    candidate = (three_root / Path(*relative.split("/"))).resolve()
    if not candidate.is_relative_to(three_root) or not candidate.is_file():
        return None
    return candidate


def resolve_route(
    raw_path: str,
    *,
    asset: Path,
    three_root: Path,
    viewer_html: Path,
    viewer_js: Path,
) -> Route:
    """Resolve only the stock page, its GLB, and installed Three.js files."""
    try:
        request_path = unquote(urlsplit(raw_path).path, errors="strict")
    except (UnicodeDecodeError, ValueError):
        return Route(400)
    if "\\" in request_path or "\x00" in request_path:
        return Route(400)
    if any(part in (".", "..") for part in request_path.split("/")):
        return Route(400)
    if request_path == "/":
        return Route(302, location=REDIRECT_LOCATION)

    exact_files = {
        VIEWER_PATH: viewer_html,
        VIEWER_JS_PATH: viewer_js,
        GLB_PATH: asset,
    }
    file_path = exact_files.get(request_path)
    if file_path is not None and file_path.is_file():
        content_type = "model/gltf-binary" if request_path == GLB_PATH else mimetypes.guess_type(file_path.name)[0]
        if request_path in (VIEWER_PATH, VIEWER_JS_PATH):
            content_type = "text/html; charset=utf-8" if request_path == VIEWER_PATH else "text/javascript; charset=utf-8"
        return Route(200, file_path=file_path, content_type=content_type or "application/octet-stream")
    if request_path.startswith(THREE_PREFIX):
        candidate = _safe_three_file(request_path, three_root)
        if candidate is not None:
            content_type = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
            if candidate.suffix == ".js":
                content_type = "text/javascript; charset=utf-8"
            return Route(200, file_path=candidate, content_type=content_type)
    return Route(404)


def verify_inputs(asset: Path, three_root: Path, port: int) -> dict:
    asset = asset.resolve()
    three_root = three_root.resolve()
    if not asset.is_file() or asset.suffix.lower() != ".glb":
        raise ValueError(f"--asset must be an existing GLB file: {asset}")
    if not asset.is_relative_to(REFINEMENT_ROOT):
        raise ValueError(f"--asset must remain inside {REFINEMENT_ROOT}")
    if not three_root.is_dir():
        raise ValueError(f"--three-root must be an existing installed Three.js directory: {three_root}")
    required_three_files = (
        three_root / "build/three.module.js",
        three_root / "examples/jsm/loaders/GLTFLoader.js",
        three_root / "examples/jsm/controls/OrbitControls.js",
    )
    missing_three = [str(path) for path in required_three_files if not path.is_file()]
    if missing_three:
        raise ValueError(f"--three-root is missing stock viewer dependencies: {missing_three}")
    if not 1 <= port <= 65535:
        raise ValueError("--port must be between 1 and 65535")

    copied_html = ASSET_COPY_DIR / "viewer.html"
    copied_js = ASSET_COPY_DIR / "viewer.js"
    file_records = []
    for role, source, copy in (
        ("viewerHtml", SOURCE_VIEWER_HTML, copied_html),
        ("viewerJs", SOURCE_VIEWER_JS, copied_js),
    ):
        if not source.is_file() or not copy.is_file():
            raise ValueError(f"missing source/copy for {role}: {source} / {copy}")
        source_hash, copy_hash = file_sha256(source), file_sha256(copy)
        if source_hash != copy_hash or source.read_bytes() != copy.read_bytes():
            raise ValueError(f"{role} adapter copy is not byte-identical to the production source")
        file_records.append({
            "role": role,
            "sourcePath": str(source.resolve()),
            "copyPath": str(copy.resolve()),
            "sourceSha256": source_hash,
            "copySha256": copy_hash,
            "byteIdentical": True,
        })

    routes = [
        ("/", 302),
        (VIEWER_PATH, 200),
        (VIEWER_JS_PATH, 200),
        (GLB_PATH, 200),
        (THREE_PREFIX + "build/three.module.js", 200),
        (THREE_PREFIX + "examples/jsm/loaders/GLTFLoader.js", 200),
        (THREE_PREFIX + "examples/jsm/controls/OrbitControls.js", 200),
        (THREE_PREFIX, 404),
        ("/not-allowlisted", 404),
        (THREE_PREFIX + "%2e%2e/%2e%2e/secrets.txt", 400),
        ("/export/%2e%2e/secrets.txt", 400),
    ]
    route_checks = []
    for path, expected_status in routes:
        result = resolve_route(
            path,
            asset=asset,
            three_root=three_root,
            viewer_html=copied_html,
            viewer_js=copied_js,
        )
        if result.status != expected_status:
            raise RuntimeError(f"route preflight mismatch for {path}: expected {expected_status}, got {result.status}")
        route_checks.append({"path": path, "status": result.status, "expectedStatus": expected_status})

    three_entry_hashes = {
        str(path.relative_to(three_root)).replace("\\", "/"): file_sha256(path)
        for path in required_three_files
    }
    return {
        "schemaVersion": 1,
        "result": "PASS",
        "server": {
            "host": HOST,
            "port": port,
            "url": f"http://{HOST}:{port}{VIEWER_PATH}?asset=final",
            "bindScope": "loopback-only",
        },
        "readOnlyPolicy": {
            "methods": ["GET", "HEAD"],
            "allowlistedFileRoutesOnly": True,
            "directoryListing": False,
            "pathTraversalRejected": True,
            "sourceViewerServedFromCopies": True,
            "writesToProductionViewerOrThree": False,
        },
        "viewerCopies": file_records,
        "asset": {
            "path": str(asset),
            "bytes": asset.stat().st_size,
            "sha256": file_sha256(asset),
            "virtualRoute": GLB_PATH,
        },
        "three": {
            "root": str(three_root),
            "verifiedEntryFileSha256": three_entry_hashes,
            "virtualPrefix": THREE_PREFIX,
        },
        "routeChecks": route_checks,
    }


def write_reports(adapter_report: dict) -> None:
    ADAPTER_REPORT.parent.mkdir(parents=True, exist_ok=True)
    ADAPTER_REPORT.write_text(json.dumps(adapter_report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if not MATERIAL_REPORT.is_file():
        raise FileNotFoundError(f"material report is missing: {MATERIAL_REPORT}")
    material_report = json.loads(MATERIAL_REPORT.read_text(encoding="utf-8"))
    material_report["viewerAdapter"] = adapter_report
    MATERIAL_REPORT.write_text(json.dumps(material_report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def make_handler(asset: Path, three_root: Path, viewer_html: Path, viewer_js: Path):
    class MaterialViewerHandler(BaseHTTPRequestHandler):
        server_version = "ALU-MaterialViewer/1.0"

        def _respond(self, include_body: bool) -> None:
            route = resolve_route(
                self.path,
                asset=asset,
                three_root=three_root,
                viewer_html=viewer_html,
                viewer_js=viewer_js,
            )
            if route.status == 302:
                self.send_response(302)
                self.send_header("Location", route.location or REDIRECT_LOCATION)
                self.send_header("Content-Length", "0")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                return
            if route.status != 200 or route.file_path is None:
                self.send_error(route.status)
                return
            try:
                payload = route.file_path.read_bytes()
            except OSError:
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header("Content-Type", route.content_type or "application/octet-stream")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            if include_body:
                self.wfile.write(payload)

        def do_GET(self) -> None:  # noqa: N802 - stdlib handler interface
            self._respond(include_body=True)

        def do_HEAD(self) -> None:  # noqa: N802 - stdlib handler interface
            self._respond(include_body=False)

        def do_POST(self) -> None:  # noqa: N802 - stdlib handler interface
            self.send_error(405)

        do_PUT = do_POST
        do_PATCH = do_POST
        do_DELETE = do_POST

    return MaterialViewerHandler


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset", type=Path, required=True, help="material-study GLB served at the stock viewer's GLB route")
    parser.add_argument("--three-root", type=Path, required=True, help="installed Three.js package root (contains build/ and examples/)")
    parser.add_argument("--port", type=int, required=True, help="loopback HTTP port")
    parser.add_argument("--check-only", action="store_true", help="verify routes and hashes, update reports, and exit")
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None)


def main() -> int:
    args = parse_args()
    try:
        config = verify_inputs(args.asset, args.three_root, args.port)
        viewer_html = ASSET_COPY_DIR / "viewer.html"
        viewer_js = ASSET_COPY_DIR / "viewer.js"
        handler = make_handler(args.asset.resolve(), args.three_root.resolve(), viewer_html, viewer_js)
        server = None if args.check_only else ThreadingHTTPServer((HOST, args.port), handler)
        write_reports(config)
    except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1

    print(f"MATERIAL_VIEWER_CHECK PASS: {len(config['routeChecks'])} allowlist/path checks; viewer copies hash-identical")
    print(f"MATERIAL_VIEWER_URL {config['server']['url']}")
    print(f"MATERIAL_VIEWER_REPORT {ADAPTER_REPORT}")
    if server is None:
        return 0
    print(f"MATERIAL_VIEWER_READY host={HOST} port={args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("MATERIAL_VIEWER_STOPPED", flush=True)
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
