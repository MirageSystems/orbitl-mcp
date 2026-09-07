"""Local known-item search diagnostic. Run with uv run --script this_file.py."""
# /// script
# requires-python = ">=3.11"
# dependencies = ["duckdb==1.5.5"]
# ///

import hashlib
import json
import math
import platform
import re
import sqlite3
import statistics
import tempfile
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import duckdb

# The benchmark lives in the repository, while the source Parquet remains a
# workspace-level input at ../audit-findings.parquet from the repository root.
ROOT = Path(__file__).resolve().parents[2]
STOPWORDS = frozenset("a an the is are was were be been being to of in on for from with by and or not can could should would will may might that this it as at if when which have has had do does due using use used lack missing incorrect possible potential issue vulnerability contract function".split())
PLACEHOLDERS = frozenset({"", "no recommendation", "n/a", "na", "none", "null"})


def query_for(title):
    tokens = dict.fromkeys(re.findall(r"[a-z][a-z0-9_]*", title.lower()))
    return " OR ".join('"' + word + '"' for word in tokens if word not in STOPWORDS)


def percentile(values, fraction):
    return sorted(values)[max(0, math.ceil(len(values) * fraction) - 1)]


def benchmark(rows, queries, include_recommendations):
    with tempfile.TemporaryDirectory(prefix="mirage-retrieval-") as directory:
        path = Path(directory) / "index.sqlite"
        connection = sqlite3.connect(path)
        started = time.perf_counter()
        connection.execute("CREATE VIRTUAL TABLE findings USING fts5(description, recommendation)")
        connection.executemany(
            "INSERT INTO findings(rowid, description, recommendation) VALUES (?, ?, ?)",
            ((row[0], row[2], row[3] if include_recommendations else "") for row in rows),
        )
        connection.commit()
        build_seconds = time.perf_counter() - started
        index_bytes = path.stat().st_size
        ranks = []
        first_pass_ms = []
        warm_ms = []
        for repeat in range(4):
            for finding_id, query in queries:
                started = time.perf_counter()
                hits = connection.execute(
                    "SELECT rowid FROM findings WHERE findings MATCH ? "
                    "ORDER BY bm25(findings), rowid LIMIT 10", (query,),
                ).fetchall()
                elapsed = (time.perf_counter() - started) * 1000
                if repeat == 0:
                    first_pass_ms.append(elapsed)
                    rank = next((i for i, hit in enumerate(hits, 1) if hit[0] == finding_id), None)
                    ranks.append({"finding_id": finding_id, "rank_at_10": rank})
                else:
                    warm_ms.append(elapsed)
        connection.close()
        n = len(ranks)
        return {
            "build_seconds": build_seconds,
            "index_bytes": index_bytes,
            "hit_at_1": sum(r["rank_at_10"] == 1 for r in ranks) / n,
            "hit_at_5": sum(r["rank_at_10"] is not None and r["rank_at_10"] <= 5 for r in ranks) / n,
            "hit_at_10": sum(r["rank_at_10"] is not None for r in ranks) / n,
            "mrr_at_10": sum(1 / r["rank_at_10"] if r["rank_at_10"] else 0 for r in ranks) / n,
            "first_pass_p50_ms": statistics.median(first_pass_ms),
            "warm_p50_ms": statistics.median(warm_ms),
            "warm_p95_ms": percentile(warm_ms, 0.95),
            "ranks": ranks,
        }


def main():
    dataset = ROOT / "audit-findings.parquet"
    connection = duckdb.connect()
    raw = connection.execute(
        "SELECT id, bug_title, bug_desc, bug_rec, bug_full FROM read_parquet(?) ORDER BY id",
        [str(dataset)],
    ).fetchall()
    connection.close()
    seen = set()
    rows = []
    for finding_id, title, description, recommendation, full in raw:
        if full in seen:
            continue
        seen.add(full)
        recommendation = recommendation or ""
        if recommendation.strip().lower().rstrip(".") in PLACEHOLDERS:
            recommendation = ""
        rows.append((finding_id, title or "", description or "", recommendation))
    assert len({r[0] for r in rows}) == len(rows), "Finding IDs must be unique"
    counts = Counter(row[2] for row in rows)
    eligible = [row for row in rows if counts[row[2]] == 1 and len(row[2]) >= 50 and query_for(row[1])]
    eligible.sort(key=lambda row: hashlib.sha256(f"mirage-baseline-v1:{row[0]}".encode()).digest())
    queries = [(row[0], query_for(row[1])) for row in eligible[:200]]
    assert len(queries) == 200, "The benchmark requires 200 sampled queries"
    query_ids = [finding_id for finding_id, _ in queries]
    assert all(isinstance(finding_id, int) for finding_id in query_ids), (
        "Sampled finding IDs must be integers"
    )
    assert len(set(query_ids)) == len(query_ids), "Sampled finding IDs must be unique"
    results = {
        "benchmark": "known-item-title-to-body-v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "dataset_sha256": hashlib.sha256(dataset.read_bytes()).hexdigest(),
        "script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "environment": {"platform": platform.platform(), "python": platform.python_version(),
                        "sqlite": sqlite3.sqlite_version, "duckdb": duckdb.__version__},
        "raw_records": len(raw), "indexed_records": len(rows), "eligible_queries": len(eligible),
        "query_count": len(queries), "query_ids": query_ids,
        "method": "SQLite FTS5 default tokenizer and BM25; OR of non-stopword title tokens; title and PoC excluded from index; exact full-text deduplication; unique descriptions in query sample; one first pass and three warm repeats; sequential execution.",
        "limits": [
            "Known-item diagnostic, not independent relevance labels or audit verdicts.",
            "Titles and bodies come from the same report; shared wording makes this easier than reviewer queries.",
            "Near-duplicate reports and project overlap are not excluded.",
            "Recommendations are unvalidated reference text and may repeat descriptions.",
            "Timing includes SQL ranking and fetching only; no model or network time. First pass is not a cold OS-cache measurement.",
            "One machine and one run; no production latency or Rust-versus-TypeScript conclusion.",
        ],
        "variants": {},
    }
    for name, include_recommendations in [("description", False), ("description_recommendation", True)]:
        results["variants"][name] = benchmark(rows, queries, include_recommendations)
    output = Path(__file__).with_name("results.json")
    output.write_text(json.dumps(results, indent=2) + "\n")
    for name, metrics in results["variants"].items():
        print(name, json.dumps({k: v for k, v in metrics.items() if k != "ranks"}))


if __name__ == "__main__":
    main()
