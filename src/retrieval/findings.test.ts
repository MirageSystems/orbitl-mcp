import assert from "node:assert/strict";
import test from "node:test";
import { parseCorpus, parseFinding, referenceExcerpt } from "./findings.js";

import { DatabaseSync } from "node:sqlite";
import {
  createFindingReader,
  writeIndex,
  searchFindings,
  readFinding,
} from "./store.js";

const raw = {
  version: 1,
  datasetSha256: "a".repeat(64),
  findings: [
    {
      id: 1,
      source: "a.md",
      title: "UniqueTitleOnly",
      description: "Rounding affects accounting.",
      recommendation: "No recommendation",
      severity: "Low",
      rawSeverity: "low",
    },
    {
      id: 2,
      source: "b.md",
      title: "Reference B",
      description: "Different text.",
      recommendation: "Review rounding assumptions.",
      severity: "Unknown",
      rawSeverity: "?",
    },
  ],
};

test("validates external corpus data and preserves provenance", () => {
  const corpus = parseCorpus(raw);
  assert.equal(corpus.findings[0]?.recommendation, "");
  assert.equal(corpus.findings[1]?.rawSeverity, "?");
  assert.throws(
    () => parseCorpus({ ...raw, findings: [raw.findings[0], raw.findings[0]] }),
    /Duplicate/,
  );
  assert.throws(() => parseCorpus({ ...raw, datasetSha256: "bad" }), /Invalid/);
  assert.throws(
    () =>
      parseCorpus({
        ...raw,
        findings: [{ ...raw.findings[0], description: null }],
      }),
    /Invalid/,
  );
  assert.equal(parseFinding(raw.findings[0]).recommendation, "");
});

test("searches bodies and recommendations without title leakage or query syntax", (t) => {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  writeIndex(db, parseCorpus(raw));
  const search = (query: string, limit?: number) =>
    searchFindings(db, query, limit);
  assert.deepEqual(
    new Set(search("rounding").map((hit) => hit.finding.id)),
    new Set([1, 2]),
  );
  assert.deepEqual(search("UniqueTitleOnly"), []);
  assert.deepEqual(search('" OR * ()'), []);
  assert.deepEqual(search("xyzunmatched"), []);
  assert.throws(() => search("rounding", 11), /limit/);
  assert.throws(() => search("a".repeat(2049)), /2048/);
  assert.equal(search("rounding", 1).length, 1);
});

test("marks truncated reference text and keeps the original available", (t) => {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  const corpus = parseCorpus({
    ...raw,
    findings: [{ ...raw.findings[0], description: "rounding ".repeat(300) }],
  });
  writeIndex(db, corpus);
  const hit = searchFindings(db, "rounding")[0]!;
  assert.equal(readFinding(db, 1).description.length, 2700);
  const excerpt = referenceExcerpt(hit);
  assert.equal(excerpt.description.length, 2000);
  assert.equal(excerpt.truncated, true);
  assert.equal(hit.finding.description.length, 2700);
});

test("reuses the reader metadata and prepared lookup statements", (t) => {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  writeIndex(db, parseCorpus(raw));
  const reader = createFindingReader(db);
  db.prepare("UPDATE metadata SET dataset_sha256 = ?").run("b".repeat(64));
  assert.equal(reader.datasetSha256, "a".repeat(64));
  assert.equal(reader.read(1).id, 1);
  assert.deepEqual(
    reader.search("rounding").map((hit) => hit.finding.id),
    [1, 2],
  );
  assert.equal(reader.read(2).source, "b.md");
});

test("rejects invalid reader metadata and payloads", (t) => {
  const metadataDb = new DatabaseSync(":memory:");
  t.after(() => metadataDb.close());
  writeIndex(metadataDb, parseCorpus(raw));
  metadataDb.prepare("UPDATE metadata SET version = ?").run(2);
  assert.throws(
    () => createFindingReader(metadataDb),
    /Unsupported findings index/,
  );

  const payloadDb = new DatabaseSync(":memory:");
  t.after(() => payloadDb.close());
  writeIndex(payloadDb, parseCorpus(raw));
  payloadDb
    .prepare("UPDATE payloads SET payload = ? WHERE id = 1")
    .run(JSON.stringify({ ...raw.findings[0], id: "bad" }));
  const reader = createFindingReader(payloadDb);
  assert.throws(() => reader.read(1), /Invalid finding/);
});

test("reader search keeps query bounds", (t) => {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  writeIndex(db, parseCorpus(raw));
  const search = createFindingReader(db).search;
  assert.throws(() => search("rounding", 0), /limit/);
  assert.throws(() => search("rounding", 11), /limit/);
  assert.throws(() => search("a".repeat(2049)), /2048/);
  assert.throws(
    () =>
      search(
        Array.from({ length: 65 }, (_, index) => `word${index}`).join(" "),
      ),
    /64/,
  );
});

test("reference excerpts do not split surrogate pairs", () => {
  const finding = parseFinding({
    ...raw.findings[0],
    description: "a".repeat(1999) + "😀",
  });
  const excerpt = referenceExcerpt({ finding, lexicalScore: 0 });
  assert.equal(excerpt.description, "a".repeat(1999));
  assert.equal(excerpt.truncated, true);
});

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("CLI publishes a complete persistent index and refuses replacement", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "orbitl-cli-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const corpus = join(directory, "corpus.json");
  const index = join(directory, "index.sqlite");
  writeFileSync(corpus, JSON.stringify(raw));
  const run = (...args: string[]) =>
    spawnSync(
      process.execPath,
      ["--import", "tsx", "src/retrieval/cli.ts", "--index", index, ...args],
      { encoding: "utf8" },
    );
  const built = run("--build", corpus);
  assert.equal(built.status, 0, built.stderr);
  const before = readFileSync(index);
  const repeated = run("--build", corpus);
  assert.notEqual(repeated.status, 0);
  assert.deepEqual(readFileSync(index), before);
  const searched = run("--query", "rounding");
  assert.equal(searched.status, 0, searched.stderr);
  assert.equal(JSON.parse(searched.stdout).references.length, 2);
  const fetched = run("--id", "2");
  assert.equal(fetched.status, 0, fetched.stderr);
  assert.equal(JSON.parse(fetched.stdout).finding.source, "b.md");
  assert.notEqual(run("--query", "rounding", "--limit", "0").status, 0);
  assert.deepEqual(readFileSync(index), before);
});

test("failed indexing rolls back without leaving a partial schema", (t) => {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  const corpus = parseCorpus(raw);
  assert.throws(() =>
    writeIndex(db, {
      ...corpus,
      findings: [corpus.findings[0]!, corpus.findings[0]!],
    }),
  );
  assert.equal(
    db
      .prepare(
        "SELECT count(*) AS n FROM sqlite_master WHERE name = 'metadata'",
      )
      .get()?.n,
    0,
  );
  writeIndex(db, corpus);
  assert.equal(readFinding(db, 1).source, "a.md");
});
