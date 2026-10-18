#!/usr/bin/env python3
"""Install verified PDD course PNG assets into an isolated PWA output tree.

No database, Docker, remote API, secrets or production side effects.
"""
import argparse
import hashlib
import json
import pathlib
import shutil
import sys


def fail(message):
    raise SystemExit(f"BLOCKED: {message}")


def install(root: pathlib.Path, target: pathlib.Path):
    root = root.resolve(strict=True)
    target = target.resolve(strict=True)
    manifest_path = root / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("package") != "driving-school-course-media" or manifest.get("version") != "1.0.0":
        fail("unsupported course-media package or version")
    files = manifest.get("files")
    if not isinstance(files, list) or len(files) != 383 or manifest.get("count") != 383:
        fail("expected exactly 383 manifest entries")
    names = set()
    total = 0
    expected = {}
    for entry in files:
        name = entry.get("file")
        if not isinstance(name, str) or not name.startswith("i") or not name.endswith(".png"):
            fail("invalid asset name")
        if pathlib.PurePath(name).name != name or "/" in name or "\\" in name or name in names:
            fail("unsafe or duplicate asset path")
        names.add(name)
        file_path = root / "img" / name
        if not file_path.is_file() or file_path.is_symlink():
            fail(f"missing or symlinked file: {name}")
        content = file_path.read_bytes()
        digest = hashlib.sha256(content).hexdigest()
        if digest != entry.get("sha256") or len(content) != entry.get("size"):
            fail(f"checksum/size mismatch: {name}")
        if content[:8] != b"\x89PNG\r\n\x1a\n" or entry.get("mime") != "image/png":
            fail(f"not a PNG: {name}")
        total += len(content)
        expected[name] = content
    actual = {p.name for p in (root / "img").iterdir() if p.is_file()}
    if actual != names or total != manifest.get("total_bytes"):
        fail("unexpected files or total size mismatch")
    dest = target / "course-import" / "img"
    if dest.is_symlink():
        fail("destination is a symlink")
    dest.mkdir(parents=True, exist_ok=True)
    for name, content in expected.items():
        path = dest / name
        if path.is_symlink():
            fail(f"destination symlink: {name}")
        if path.exists() and path.read_bytes() == content:
            continue
        path.write_bytes(content)
    for name, content in expected.items():
        if hashlib.sha256((dest / name).read_bytes()).hexdigest() != hashlib.sha256(content).hexdigest():
            fail(f"post-install verification failed: {name}")
    print(f"PASS course-media {manifest['version']}: {len(files)} PNG installed and verified in {dest}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", required=True, help="existing, isolated PWA build directory")
    parser.add_argument("--package", default=str(pathlib.Path(__file__).resolve().parents[1] / "course-media"))
    args = parser.parse_args()
    target = pathlib.Path(args.target)
    if not target.is_dir() or target.is_symlink():
        fail("PWA build directory must exist and not be a symlink")
    install(pathlib.Path(args.package), target)


if __name__ == "__main__":
    main()
