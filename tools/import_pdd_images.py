#!/usr/bin/env python3
"""Download and verify source-course PNGs into a staging folder (no DB changes).

Usage:
  python3 tools/import_pdd_images.py
  python3 tools/import_pdd_images.py --verify-only

Default destination: public/course-import/img/
"""
import argparse
import json
import shutil
import sys
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "tools" / "pdd-source-images-manifest.json"
OUTPUT = ROOT / "public" / "course-import"


def validate_path(value):
    p = Path(value)
    if (not isinstance(value, str) or p.is_absolute() or len(p.parts) != 2
            or p.parts[0] != "img" or p.suffix.lower() != ".png"
            or any(part in ("", ".", "..") for part in p.parts)):
        raise ValueError(f"Unsafe image path: {value!r}")
    return p


def valid_png(raw):
    return raw[:8] == b"\x89PNG\r\n\x1a\n" and len(raw) > 24


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    paths = [validate_path(name) for name in manifest["images"]]
    if len(paths) != 383 or len(set(paths)) != len(paths):
        raise ValueError("Expected 383 unique safe image paths")
    if manifest.get("source_repository") != "motostrelok1/edu.dvizh-teory":
        raise ValueError("Unexpected source repository")
    commit = manifest["source_commit"]
    if len(commit) != 40 or any(ch not in "0123456789abcdef" for ch in commit):
        raise ValueError("Source commit must be a pinned 40-char SHA")

    missing = []
    for i, path in enumerate(paths, 1):
        target = OUTPUT / path
        if target.exists() and valid_png(target.read_bytes()):
            continue
        if args.verify_only:
            missing.append(str(path))
            continue
        url = f"https://raw.githubusercontent.com/motostrelok1/edu.dvizh-teory/{commit}/public/{path.as_posix()}"
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "dvizh-course-import"}), timeout=30) as response:
            content = response.read(15_000_001)
        if len(content) > 15_000_000 or not valid_png(content):
            raise ValueError(f"Invalid/too large PNG: {path}")
        target.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as tmp:
            tmp.write(content)
            tmp_name = Path(tmp.name)
        tmp_name.replace(target)
        print(f"[{i}/{len(paths)}] {path}")

    if missing:
        print(f"FAIL: {len(missing)} missing/invalid files. First: {missing[:5]}", file=sys.stderr)
        return 1
    if args.verify_only:
        print(f"PASS: all {len(paths)} PNGs exist and have PNG signatures.")
    else:
        print(f"Download complete. Re-run: python3 tools/import_pdd_images.py --verify-only")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)
