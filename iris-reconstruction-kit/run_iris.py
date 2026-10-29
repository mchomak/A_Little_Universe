"""Repo-friendly launcher for the offline iris asset baker.

Examples:
    python run_iris.py "C:/Photos/eye.heic" --interactive
    python run_iris.py --input "C:/Photos/eye.heic" --output outputs/eye --interactive

The implementation is maintained in the iris_baker package.
"""

from __future__ import annotations

import sys

from iris_baker.cli import main


if __name__ == "__main__":
    args = sys.argv[1:]
    # Allow the photograph to be supplied as a simple positional argument.
    # Preserve all existing flags and the original `python -m iris_baker` API.
    if args and not args[0].startswith("-"):
        args = ["--input", args[0], *args[1:]]
    raise SystemExit(main(args))
