import type { DatabaseSync } from "node:sqlite";
import {
  parseFinding,
  queryTerms,
  type Corpus,
  type Finding,
  type ReferenceHit,
} from "./findings.js";

export type FindingReader = Readonly<{
  datasetSha256: string;
  search(query: string, limit?: number): readonly ReferenceHit[];
  read(id: number): Finding;
}>;

export function writeIndex(db: DatabaseSync, corpus: Corpus): void {
  db.exec("BEGIN");
  try {
    db.exec(`
      CREATE TABLE metadata (version INTEGER NOT NULL, dataset_sha256 TEXT NOT NULL);
      CREATE TABLE payloads (id INTEGER PRIMARY KEY, payload TEXT NOT NULL);
      CREATE VIRTUAL TABLE findings USING fts5(description, recommendation);
    `);
    db.prepare("INSERT INTO metadata VALUES (1, ?)").run(corpus.datasetSha256);
    const payload = db.prepare("INSERT INTO payloads VALUES (?, ?)");
    const text = db.prepare(
      "INSERT INTO findings(rowid, description, recommendation) VALUES (?, ?, ?)",
    );
    for (const finding of corpus.findings) {
      payload.run(finding.id, JSON.stringify(finding));
      text.run(finding.id, finding.description, finding.recommendation);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function indexHash(db: DatabaseSync): string {
  return readIndexMetadata(db);
}

const readIndexMetadata = (db: DatabaseSync): string => {
  const metadata = db
    .prepare("SELECT version, dataset_sha256 FROM metadata")
    .get();
  if (
    metadata?.version !== 1 ||
    typeof metadata.dataset_sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(metadata.dataset_sha256)
  )
    throw new Error("Unsupported findings index.");
  return metadata.dataset_sha256;
};

export function createFindingReader(db: DatabaseSync): FindingReader {
  const datasetSha256 = readIndexMetadata(db);
  const payloadStatement = db.prepare(
    "SELECT payload FROM payloads WHERE id = ?",
  );
  const searchStatement = db.prepare(
    "SELECT rowid, bm25(findings) AS score FROM findings WHERE findings MATCH ? ORDER BY score, rowid LIMIT ?",
  );

  const read = (id: number): Finding => {
    if (!Number.isSafeInteger(id))
      throw new Error("ID must be a safe integer.");
    const row = payloadStatement.get(id);
    if (typeof row?.payload !== "string")
      throw new Error("Finding ID not found in this index.");
    const finding = parseFinding(JSON.parse(row.payload));
    if (finding.id !== id) throw new Error("Invalid finding payload.");
    return finding;
  };

  const search = (query: string, limit = 5): readonly ReferenceHit[] => {
    if (!Number.isInteger(limit) || limit < 1 || limit > 10)
      throw new Error("Result limit must be an integer between 1 and 10.");
    if (query.length > 2048)
      throw new Error("Query must contain at most 2048 characters.");
    const terms = queryTerms(query);
    if (terms.length > 64)
      throw new Error("Query must contain at most 64 searchable terms.");
    if (!terms.length) return [];
    const expression = terms.map((term) => `"${term}"`).join(" OR ");
    return searchStatement.all(expression, limit).map((row) => {
      if (typeof row.rowid !== "number" || typeof row.score !== "number")
        throw new Error("Invalid search result.");
      return { finding: read(row.rowid), lexicalScore: -row.score };
    });
  };

  return Object.freeze({ datasetSha256, search, read });
}

export function readFinding(db: DatabaseSync, id: number): Finding {
  return createFindingReader(db).read(id);
}

export function searchFindings(
  db: DatabaseSync,
  query: string,
  limit = 5,
): readonly ReferenceHit[] {
  return createFindingReader(db).search(query, limit);
}
