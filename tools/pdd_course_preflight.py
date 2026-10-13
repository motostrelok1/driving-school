#!/usr/bin/env python3
"""Read-only preflight for edu.dvizh-teory/public/sections.json.

Usage: python3 tools/pdd_course_preflight.py path/to/sections.json
Does not write files or connect to Supabase.
"""
import json
import sys
from collections import Counter
from pathlib import Path

EXPECTED_TYPES = {"p", "h2", "img", "motivation", "topic", "lead", "quote", "term", "example", "quiz"}


def analyze(data):
    sections = data.get("sections")
    if not isinstance(sections, list) or not sections:
        raise ValueError("sections must be a non-empty array")
    ids, images, problems = set(), set(), []
    counts = Counter()
    manifest = []
    for s in sections:
        sid = s.get("id")
        if not isinstance(sid, str) or not sid or sid in ids:
            raise ValueError(f"Duplicate or invalid section id: {sid!r}")
        ids.add(sid)
        blocks = s.get("blocks")
        if not isinstance(blocks, list):
            raise ValueError(f"blocks missing in {sid}")
        local = Counter()
        for index, block in enumerate(blocks):
            kind = block.get("type") if isinstance(block, dict) else None
            if kind not in EXPECTED_TYPES:
                problems.append(f"{sid}:{index}: unknown type {kind!r}")
                continue
            counts[kind] += 1
            local[kind] += 1
            if kind == "img":
                src = block.get("src")
                if not isinstance(src, str) or not src:
                    problems.append(f"{sid}:{index}: missing image src")
                else:
                    images.add(src)
            elif kind == "quiz":
                questions = block.get("questions", [])
                if not isinstance(questions, list):
                    problems.append(f"{sid}:{index}: invalid questions")
                    continue
                for qi, q in enumerate(questions):
                    opts = q.get("options", []) if isinstance(q, dict) else []
                    answer = q.get("correct") if isinstance(q, dict) else None
                    if not isinstance(opts, list) or not isinstance(answer, int) or isinstance(answer, bool) or not 0 <= answer < len(opts):
                        problems.append(f"{sid}:{index}:{qi}: invalid correct answer")
                    counts["questions"] += 1
        manifest.append({"source_id": sid, "title": s.get("title"), "blocks": len(blocks), "types": dict(local)})
    return {"sections": len(sections), "blocks": sum(m["blocks"] for m in manifest),
            "images_unique": len(images), "types": dict(counts),
            "manifest": manifest, "problems": problems}


def main(argv):
    if len(argv) != 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    try:
        source = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
        result = analyze(source)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if result["problems"] else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
