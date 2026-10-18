#!/usr/bin/env python3
"""Static guardrails; not a substitute for testing migrations in PostgreSQL."""
from pathlib import Path
import re
import sys

files = sorted(Path("supabase/migrations").glob("*.sql"))
if not files:
    sys.exit("No SQL migrations found")
seen = set()
for path in files:
    if not re.fullmatch(r"[0-9]{4,14}_[a-zA-Z0-9_]+\.sql", path.name):
        sys.exit(f"Invalid migration filename: {path.name}")
    if path.name in seen:
        sys.exit(f"Duplicate filename: {path.name}")
    seen.add(path.name)
    if not path.read_text(encoding="utf-8").strip():
        sys.exit(f"Empty SQL file: {path.name}")
print(f"Validated {len(files)} migration files (filename ordering, not numeric uniqueness).")
