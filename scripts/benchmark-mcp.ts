import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { parseCorpus } from "../src/retrieval/findings.js";

const [indexPath, corpusPath, samplePath, outputPath] = process.argv.slice(2);
if (!indexPath || !corpusPath || !samplePath || !outputPath) {
  throw new Error(
    "Usage: benchmark-mcp.ts <index.sqlite> <corpus.json> <sample.json> <output.json>",
  );
}
const corpus = parseCorpus(JSON.parse(await readFile(corpusPath, "utf8")));
const sample: unknown = JSON.parse(await readFile(samplePath, "utf8"));
if (
  !sample ||
  typeof sample !== "object" ||
  !("dataset_sha256" in sample) ||
  sample.dataset_sha256 !== corpus.datasetSha256 ||
  !("query_ids" in sample) ||
  !Array.isArray(sample.query_ids) ||
  sample.query_ids.length !== 200 ||
  !sample.query_ids.every(
    (id) => typeof id === "number" && Number.isSafeInteger(id),
  ) ||
  new Set(sample.query_ids).size !== 200
) {
  throw new Error(
    "Expected a matching dataset hash and 200 unique sampled IDs.",
  );
}
const byId = new Map(corpus.findings.map((finding) => [finding.id, finding]));
const queries = sample.query_ids.map((id) => {
  const finding = byId.get(id);
  if (!finding) throw new Error(`Sampled finding ${id} is absent.`);
  return { id, query: finding.title };
});
const starts: { initializeMs: number; initializeAndFirstSearchMs: number }[] =
  [];
const warmMs: number[] = [];
const ranks: { findingId: number; rank: number | null }[] = [];
let maxResultBytes = 0;
for (let session = 0; session < 3; session++) {
  const client = new Client({ name: "orbitl-mcp-benchmark", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve("dist/mcp/cli.js"), "--index", resolve(indexPath)],
    stderr: "pipe",
  });
  transport.stderr?.on("data", () => {});
  try {
    const started = performance.now();
    await client.connect(transport);
    const initializeMs = performance.now() - started;
    await client.callTool({
      name: "search_audit_references",
      arguments: { query: "rounding accounting", limit: 5 },
    });
    starts.push({
      initializeMs,
      initializeAndFirstSearchMs: performance.now() - started,
    });
    if (session !== 0) continue;
    for (let repeat = 0; repeat < 3; repeat++) {
      for (const { id, query } of queries) {
        const started = performance.now();
        const response = await client.callTool({
          name: "search_audit_references",
          arguments: { query, limit: 10 },
        });
        warmMs.push(performance.now() - started);
        if (response.isError)
          throw new Error(`MCP query failed for sampled finding ${id}.`);
        const data: unknown = response.structuredContent;
        if (
          !data ||
          typeof data !== "object" ||
          !("datasetSha256" in data) ||
          data.datasetSha256 !== corpus.datasetSha256 ||
          !("references" in data) ||
          !Array.isArray(data.references) ||
          !data.references.every(
            (reference: unknown) =>
              typeof reference === "object" &&
              reference !== null &&
              "id" in reference &&
              typeof reference.id === "number",
          )
        )
          throw new Error("Invalid MCP reference output.");
        const references = data.references as { id: number }[];
        if (repeat === 0) {
          const index = references.findIndex(
            (reference) => reference.id === id,
          );
          ranks.push({ findingId: id, rank: index < 0 ? null : index + 1 });
        }
        maxResultBytes = Math.max(
          maxResultBytes,
          Buffer.byteLength(JSON.stringify(response), "utf8"),
        );
      }
    }
  } finally {
    await client.close();
  }
}
const quantile = (values: number[], fraction: number) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
const sourceFiles = [
  "src/retrieval/store.ts",
  "src/retrieval/findings.ts",
  "src/mcp/context.ts",
  "src/mcp/server.ts",
  "src/mcp/cli.ts",
];
const result = {
  benchmark: "mcp-known-item-v1",
  createdAt: new Date().toISOString(),
  harnessSha256: createHash("sha256")
    .update(await readFile(new URL(import.meta.url)))
    .digest("hex"),
  lockfileSha256: createHash("sha256")
    .update(await readFile("pnpm-lock.yaml"))
    .digest("hex"),
  node: process.version,
  protocol: "legacy initialize with official SDK v2 client",
  datasetSha256: corpus.datasetSha256,
  implementationSha256: createHash("sha256")
    .update(
      Buffer.concat(
        await Promise.all(sourceFiles.map((file) => readFile(file))),
      ),
    )
    .digest("hex"),
  sourceFiles,
  queryCount: queries.length,
  starts,
  warmCalls: warmMs.length,
  warmP50Ms: quantile(warmMs, 0.5),
  warmP95Ms: quantile(warmMs, 0.95),
  maxResultBytes,
  hitAt5:
    ranks.filter((r) => r.rank !== null && r.rank <= 5).length / ranks.length,
  hitAt10: ranks.filter((r) => r.rank !== null).length / ranks.length,
  ranks,
  limits:
    "Local stdio process startup, initialization, serialization, validation, SQLite search, and bounded context assembly. Three starts and three sequential query passes in the first process. OS caches uncontrolled. Same development title-to-body sample; no independent relevance or audit verdict labels, no model calls or network latency.",
};
await writeFile(outputPath, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ ...result, ranks: undefined }, null, 2));
