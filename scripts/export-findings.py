# /// script
# requires-python = ">=3.11"
# dependencies = ["duckdb==1.5.5"]
# ///
"""Convert the local parquet into the versioned reference corpus. No PoC payload."""
import hashlib
import json
import sys
from pathlib import Path

import duckdb

if len(sys.argv) != 3:
    raise SystemExit("Usage: export-findings.py <parquet> <new-output.json>")
source, output = map(Path, sys.argv[1:])
connection = duckdb.connect()
rows = connection.execute(
    "SELECT id, file_name, bug_title, bug_desc, bug_rec, bug_sev, bug_sev_raw, bug_full "
    "FROM read_parquet(?) ORDER BY id", [str(source)],
).fetchall()
connection.close()
seen = set()
findings = []
for row in rows:
    if row[7] in seen:
        continue
    seen.add(row[7])
    findings.append(dict(zip(
        ["id", "source", "title", "description", "recommendation", "severity", "rawSeverity"], row[:7],
    )))
corpus = {"version": 1, "datasetSha256": hashlib.sha256(source.read_bytes()).hexdigest(), "findings": findings}
output.parent.mkdir(parents=True, exist_ok=True)
with output.open("x") as stream:
    json.dump(corpus, stream)
    stream.write("\n")
print(f"Exported {len(findings)} findings to {output}")
