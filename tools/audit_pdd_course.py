#!/usr/bin/env python3
"""Read-only audit of the bundled 30-section PDD course and local media.

Run on server after importing images:
  python3 tools/audit_pdd_course.py
"""
import json
import re
import sys
from pathlib import Path

from pdd_course_preflight import analyze

ROOT = Path(__file__).resolve().parent.parent
SECTIONS = ROOT / "public/course-import/sections.json"
MANIFEST = ROOT / "tools/pdd-source-images-manifest.json"
MEDIA = ROOT / "public/course-import"
EXPECTED_IDS = {*(f"s{i}" for i in range(1, 27)), "signs", "markup", "dopusk", "neispravnosti"}
SAFE_IMAGE = re.compile(r"^img/[a-zA-Z0-9_-]+\.png$")
SAFE_LINK = re.compile(r"^https://[^\s]+$|^/admin/pdd/preview\?section=(?:s(?:[1-9]|1\d|2[0-6])|signs|markup|dopusk|neispravnosti)$")


def main():
    course = json.loads(SECTIONS.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    report = analyze(course)
    issues = list(report["problems"])
    sections = course["sections"]
    ids = [section["id"] for section in sections]
    if len(ids) != 30 or set(ids) != EXPECTED_IDS:
        issues.append(f"Expected 30 specific sections; found {len(ids)} / {len(set(ids))} distinct")
    image_names = set()
    question_count = 0
    for section in sections:
        if not isinstance(section.get("title"), str) or not section["title"].strip():
            issues.append(f"{section['id']}: title empty")
        for idx, block in enumerate(section["blocks"]):
            tag = f"{section['id']} block {idx + 1}"
            if block.get("type") == "img":
                src = block.get("src")
                if not isinstance(src, str) or not SAFE_IMAGE.fullmatch(src):
                    issues.append(f"{tag}: invalid media path {src!r}")
                else:
                    image_names.add(src)
            elif block.get("type") == "link" and not SAFE_LINK.fullmatch(str(block.get("url", ""))):
                issues.append(f"{tag}: invalid link")
            elif block.get("type") == "quiz":
                for qi, q in enumerate(block.get("questions", [])):
                    question_count += 1
                    if not isinstance(q.get("q"), str) or not q["q"].strip():
                        issues.append(f"{tag} question {qi + 1}: missing question text")
                    options = q.get("options")
                    if not isinstance(options, list) or len(options) < 2 or any(not isinstance(o, str) or not o.strip() for o in options):
                        issues.append(f"{tag} question {qi + 1}: invalid answer options")
    declared = set(manifest["images"])
    if len(declared) != 383 or image_names != declared:
        issues.append(f"Image manifest mismatch: used={len(image_names)} declared={len(declared)}")
    missing = []
    for name in sorted(declared):
        p = MEDIA / name
        try:
            with p.open("rb") as file:
                signature = file.read(8)
            if signature != b"\x89PNG\r\n\x1a\n":
                missing.append(name + " (invalid signature)")
        except OSError:
            missing.append(name + " (missing)")
    if missing:
        issues.append(f"Missing/invalid image files: {len(missing)}; examples: {missing[:5]}")
    print(f"Sections: {len(sections)}; blocks: {report['blocks']}; questions: {question_count}; unique images: {len(image_names)}")
    print(f"Images on disk: {len(declared) - len(missing)}/{len(declared)}")
    for issue in issues:
        print("FAIL:", issue)
    print("PASS: bundled course audit" if not issues else f"FAIL: {len(issues)} issue(s)")
    return 0 if not issues else 1


if __name__ == "__main__":
    sys.exit(main())
