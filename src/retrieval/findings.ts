export type Finding = Readonly<{
  id: number;
  source: string;
  title: string;
  description: string;
  recommendation: string;
  severity: string;
  rawSeverity: string;
}>;

export type Corpus = Readonly<{
  version: 1;
  datasetSha256: string;
  findings: readonly Finding[];
}>;

const placeholders = new Set([
  "",
  "no recommendation",
  "n/a",
  "na",
  "none",
  "null",
]);
const stopwords = new Set(
  "a an the is are was were be been being to of in on for from with by and or not can could should would will may might that this it as at if when which have has had do does due using use used lack missing incorrect possible potential issue vulnerability contract function".split(
    " ",
  ),
);

export const normalizeRecommendation = (text: string): string =>
  placeholders.has(text.trim().toLowerCase().replace(/\.$/, ""))
    ? ""
    : text.trim();

export const queryTerms = (query: string): string[] =>
  [...new Set(query.toLowerCase().match(/[a-z][a-z0-9_]*/g) ?? [])].filter(
    (term) => !stopwords.has(term),
  );

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function parseFinding(value: unknown): Finding {
  if (
    !isRecord(value) ||
    typeof value.id !== "number" ||
    !Number.isSafeInteger(value.id) ||
    typeof value.source !== "string" ||
    !value.source.trim() ||
    typeof value.title !== "string" ||
    typeof value.description !== "string" ||
    typeof value.recommendation !== "string" ||
    typeof value.severity !== "string" ||
    typeof value.rawSeverity !== "string"
  ) {
    throw new Error(
      "Invalid finding: expected a safe integer ID and text fields.",
    );
  }
  return Object.freeze({
    id: value.id,
    source: value.source,
    title: value.title,
    description: value.description,
    recommendation: normalizeRecommendation(value.recommendation),
    severity: value.severity,
    rawSeverity: value.rawSeverity,
  });
}

export function parseCorpus(value: unknown): Corpus {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.datasetSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.datasetSha256) ||
    !Array.isArray(value.findings)
  ) {
    throw new Error(
      "Invalid findings corpus: expected version 1, dataset hash, and findings.",
    );
  }
  const ids = new Set<number>();
  const findings = value.findings.map((item: unknown): Finding => {
    const finding = parseFinding(item);
    if (ids.has(finding.id))
      throw new Error(`Duplicate finding ID: ${finding.id}`);
    ids.add(finding.id);
    return finding;
  });
  return Object.freeze({
    version: 1,
    datasetSha256: value.datasetSha256,
    findings: Object.freeze(findings),
  });
}

export type ReferenceHit = Readonly<{
  finding: Finding;
  lexicalScore: number;
}>;

const truncateUtf16 = (text: string, limit: number): string => {
  const excerpt = text.slice(0, limit);
  const last = excerpt.charCodeAt(excerpt.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? excerpt.slice(0, -1) : excerpt;
};

export function referenceExcerpt(hit: ReferenceHit) {
  const { finding, lexicalScore } = hit;
  return {
    id: finding.id,
    source: finding.source,
    title: finding.title,
    severity: finding.severity,
    rawSeverity: finding.rawSeverity,
    lexicalScore,
    description: truncateUtf16(finding.description, 2000),
    recommendation: truncateUtf16(finding.recommendation, 1000),
    truncated:
      finding.description.length > 2000 || finding.recommendation.length > 1000,
  };
}
