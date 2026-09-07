import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { parseCorpus } from "../src/retrieval/findings.js";

import { DatabaseSync } from "node:sqlite";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFindingReader, writeIndex } from "../src/retrieval/store.js";

const corpusPath = process.argv[2];
const baselinePath = process.argv[3];
const outputPath = process.argv[4];
if (!corpusPath || !baselinePath || !outputPath) {
  throw new Error(
    "Usage: benchmark-retrieval.ts <corpus.json> <baseline.json> <output.json>",
  );
}
const started = performance.now();
const corpus = parseCorpus(JSON.parse(await readFile(corpusPath, "utf8")));
const loadMs = performance.now() - started;
const baselineValue: unknown = JSON.parse(await readFile(baselinePath, "utf8"));
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
if (!isRecord(baselineValue)) throw new Error("Invalid benchmark baseline.");
const baselineDatasetSha256 = baselineValue.dataset_sha256;
const queryIds = baselineValue.query_ids;
if (
  typeof baselineDatasetSha256 !== "string" ||
  baselineDatasetSha256 !== corpus.datasetSha256 ||
  !Array.isArray(queryIds) ||
  queryIds.length !== 200 ||
  queryIds.some((id) => typeof id !== "number" || !Number.isSafeInteger(id)) ||
  new Set(queryIds).size !== queryIds.length
) {
  throw new Error("Baseline does not match the corpus and 200-query sample.");
}
const queries = queryIds.map((id) => {
  const finding = corpus.findings.find((item) => item.id === id);
  if (!finding) throw new Error(`Missing benchmark finding ${id}`);
  return finding;
});
const beforeBuild = performance.now();
const directory = await mkdtemp(join(tmpdir(), "orbitl-bench-"));
const path = join(directory, "index.sqlite");
let output: object;
try {
  const writer = new DatabaseSync(path);
  try {
    writeIndex(writer, corpus);
  } finally {
    writer.close();
  }
  const buildMs = performance.now() - beforeBuild;
  const openStarted = performance.now();
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const openMs = performance.now() - openStarted;
    const sqliteVersion = db
      .prepare("SELECT sqlite_version() AS version")
      .get()?.version;
    const reader = createFindingReader(db);
    const memoryAfterBuild = process.memoryUsage();
    const ranks: { findingId: number; rank: number | null }[] = [];
    const firstMs: number[] = [];
    const warmMs: number[] = [];
    for (let repeat = 0; repeat < 4; repeat++) {
      for (const finding of queries) {
        const start = performance.now();
        const hits = reader.search(finding.title, 10);
        const elapsed = performance.now() - start;
        if (repeat === 0) {
          firstMs.push(elapsed);
          const position = hits.findIndex(
            (hit) => hit.finding.id === finding.id,
          );
          ranks.push({
            findingId: finding.id,
            rank: position < 0 ? null : position + 1,
          });
        } else warmMs.push(elapsed);
      }
    }
    const quantile = (values: number[], p: number) =>
      [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
    output = {
      benchmark: "node-sqlite-known-item-v1",
      createdAt: new Date().toISOString(),
      harnessSha256: createHash("sha256")
        .update(await readFile(new URL(import.meta.url)))
        .digest("hex"),
      lockfileSha256: createHash("sha256")
        .update(await readFile("pnpm-lock.yaml"))
        .digest("hex"),
      node: process.version,
      engine: "node:sqlite",
      sqliteVersion,
      datasetSha256: corpus.datasetSha256,
      implementationSha256: createHash("sha256")
        .update(
          Buffer.concat(
            await Promise.all(
              ["store.ts", "findings.ts"].map((name) =>
                readFile(new URL(`../src/retrieval/${name}`, import.meta.url)),
              ),
            ),
          ),
        )
        .digest("hex"),
      queryCount: queries.length,
      indexedRecords: corpus.findings.length,
      loadMs,
      buildMs,
      openMs,
      indexBytes: (await stat(path)).size,
      memoryAfterBuild,
      hitAt1: ranks.filter((r) => r.rank === 1).length / ranks.length,
      hitAt5:
        ranks.filter((r) => r.rank !== null && r.rank <= 5).length /
        ranks.length,
      hitAt10: ranks.filter((r) => r.rank !== null).length / ranks.length,
      mrrAt10:
        ranks.reduce((sum, r) => sum + (r.rank === null ? 0 : 1 / r.rank), 0) /
        ranks.length,
      firstPassP50Ms: quantile(firstMs, 0.5),
      warmP50Ms: quantile(warmMs, 0.5),
      warmP95Ms: quantile(warmMs, 0.95),
      limits:
        "Same 200 title queries as SQLite diagnostic. Titles excluded from index. Shared report wording, no independent relevance labels, no audit verdicts, no project holdout. Uses SQLite FTS5 default tokenizer and BM25. One machine and run; timing excludes model/network calls. Warm latency excludes corpus load and index build. RSS includes the benchmark process.",
      ranks,
    };
  } finally {
    db.close();
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
await writeFile(outputPath, JSON.stringify(output, null, 2) + "\n");
console.log(
  JSON.stringify(
    { ...(output as Record<string, unknown>), ranks: undefined },
    null,
    2,
  ),
);
