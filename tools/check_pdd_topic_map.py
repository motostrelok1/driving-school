#!/usr/bin/env python3
"""Validate migration mapping against real edu.dvizh-teory sections.json (read-only)."""
import json
import sys
from pathlib import Path


def validate(source, mapping):
    errors = []
    sections = source.get("sections", [])
    original_ids = [s.get("id") for s in sections]
    rows = mapping.get("sections", [])
    mapped_ids = [row["source_id"] for row in rows]
    if len(original_ids) != 30 or len(set(original_ids)) != 30:
        errors.append("source must contain 30 unique section IDs")
    if len(mapped_ids) != len(set(mapped_ids)):
        errors.append("duplicate source_id in map")
    missing = set(original_ids) - set(mapped_ids)
    unexpected = set(mapped_ids) - set(original_ids)
    if missing:
        errors.append("unmapped source IDs: " + ", ".join(sorted(missing)))
    if unexpected:
        errors.append("map IDs absent from source: " + ", ".join(sorted(unexpected)))
    targets = [str(x) for row in rows for x in row["legacy_topic_ids"]]
    expected = {str(i) for i in range(1, 39)}
    if len(targets) != len(set(targets)):
        errors.append("legacy target used more than once")
    if set(targets) != expected:
        errors.append("legacy coverage mismatch, missing=" + str(sorted(expected-set(targets), key=int))
                      + " extra=" + str(sorted(set(targets)-expected)))
    return errors


def main(argv):
    if len(argv) != 2:
        print("Usage: python3 tools/check_pdd_topic_map.py /path/to/sections.json", file=sys.stderr)
        return 2
    try:
        source = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
        mapping = json.loads(Path(__file__).with_name("pdd-course-topic-map.json").read_text(encoding="utf-8"))
        errors = validate(source, mapping)
    except (ValueError, KeyError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    if errors:
        for error in errors:
            print("FAIL:", error, file=sys.stderr)
        return 1
    print("PASS: 30 source sections mapped, legacy topics 1..38 covered exactly once")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
