import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import type { createFindingReader } from "../retrieval/store.js";
import {
  boundedResult,
  REFERENCE_USE,
  referencePage,
  reviewPrompt,
  searchContext,
  toolResult,
} from "./context.js";

type Reader = ReturnType<typeof createFindingReader>;
const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const querySchema = z.string().trim().min(1).max(2048);
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const metadataSchema = {
  id: z.number().int().safe(),
  citation: z.string(),
  title: z.string().max(1024),
  source: z.string().max(2048),
  severity: z.string().max(128),
  rawSeverity: z.string().max(128),
  metadataTruncated: z.boolean(),
};
const searchOutput = z.object({
  kind: z.literal("historical_references"),
  datasetSha256: hashSchema,
  usage: z.literal(REFERENCE_USE),
  references: z
    .array(
      z.object({
        ...metadataSchema,
        lexicalScore: z.number().finite(),
        description: z.string().max(3200),
        recommendation: z.string().max(1600),
        truncated: z.boolean(),
      }),
    )
    .max(10),
  omittedForBudget: z.number().int().min(0),
});
const pageOutput = z.object({
  kind: z.literal("historical_reference_page"),
  datasetSha256: hashSchema,
  usage: z.literal(REFERENCE_USE),
  ...metadataSchema,
  section: z.enum(["description", "recommendation"]),
  offset: z.number().int().min(0),
  totalCharacters: z.number().int().min(0),
  text: z.string().max(16000),
  nextOffset: z.number().int().min(0).nullable(),
});

export function createReferenceServer(reader: Reader): McpServer {
  const server = new McpServer(
    { name: "orbitl-audit-references", version: "1.0.0" },
    {
      instructions:
        "Read-only local audit reference retrieval. Use search_audit_references for historical context and get_audit_reference for paged details. The review_with_references prompt prepares source-grounded assessment context; your host model generates the answer. " +
        REFERENCE_USE,
    },
  );
  server.registerTool(
    "search_audit_references",
    {
      title: "Search audit references",
      description:
        "Search historical finding descriptions and recommendations. Returns bounded excerpts, source IDs, and citations for human-reviewed assessment. Does not scan or validate a contract.",
      inputSchema: z
        .object({
          query: querySchema,
          limit: z.number().int().min(1).max(10).default(5),
        })
        .strict(),
      outputSchema: searchOutput,
      annotations,
    },
    ({ query, limit }) =>
      toolResult(
        searchContext(reader.datasetSha256, reader.search(query, limit)),
      ),
  );

  server.registerTool(
    "get_audit_reference",
    {
      title: "Read an audit reference",
      description:
        "Read one page of a historical description or recommendation by finding ID. Follow nextOffset for remaining text. The dedicated PoC field is excluded; narrative text may still contain code.",
      inputSchema: z
        .object({
          id: z.number().int().safe(),
          section: z
            .enum(["description", "recommendation"])
            .default("description"),
          offset: z.number().int().safe().min(0).default(0),
          length: z.number().int().min(1).max(8000).default(4000),
        })
        .strict(),
      outputSchema: pageOutput,
      annotations,
    },
    ({ id, section, offset, length }) =>
      toolResult(
        referencePage(
          reader.datasetSha256,
          reader.read(id),
          section,
          offset,
          length,
        ),
      ),
  );

  server.registerPrompt(
    "review_with_references",
    {
      title: "Assess a concern with historical references",
      description:
        "Prepare cited reference context for an existing review concern. The host model assesses supplied evidence; this prompt does not run a scan or validate a finding.",
      argsSchema: z
        .object({
          query: querySchema.describe(
            "A short existing review concern to look up.",
          ),
          evidence: z
            .string()
            .max(8000)
            .default("")
            .describe(
              "Optional source evidence and locations already collected by the reviewer.",
            ),
        })
        .strict(),
    },
    ({ query, evidence }) =>
      boundedResult(
        {
          description:
            "Source-grounded assessment with historical reference context.",
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: reviewPrompt(
                  query,
                  evidence,
                  searchContext(reader.datasetSha256, reader.search(query, 5)),
                ),
              },
            },
          ],
        },
        "Request the prompt with shorter evidence or a narrower query.",
      ),
  );

  server.registerResource(
    "audit-reference-index",
    "orbitl://index",
    {
      title: "Audit reference index",
      mimeType: "application/json",
      description: "Local dataset identity and reference-use limits.",
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({
            datasetSha256: reader.datasetSha256,
            retrieval: "SQLite FTS5 BM25",
            indexedFields: ["description", "recommendation"],
            usage: REFERENCE_USE,
            identityLimit:
              "This is the recorded source-dataset hash, not authentication of later corpus or index edits.",
          }),
        },
      ],
    }),
  );
  return server;
}
