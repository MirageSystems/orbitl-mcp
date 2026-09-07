#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";
import {
  StdioServerTransport,
  serveStdio,
} from "@modelcontextprotocol/server/stdio";
import { createFindingReader } from "../retrieval/store.js";
import { createReferenceServer } from "./server.js";

function main(): void {
  const { values } = parseArgs({
    options: { index: { type: "string" }, help: { type: "boolean" } },
  });
  if (values.help) {
    console.log(
      "Usage: orbitl-mcp --index <existing-findings.sqlite>\nServes read-only audit references over MCP stdio.",
    );
    return;
  }
  if (!values.index)
    throw new Error(
      "Provide --index with an existing local findings database.",
    );
  const db = new DatabaseSync(values.index, {
    readOnly: true,
    allowExtension: false,
  });
  let dbClosed = false;
  const release = () => {
    if (!dbClosed) {
      dbClosed = true;
      db.close();
    }
  };
  try {
    const reader = createFindingReader(db);
    const transport = new StdioServerTransport(process.stdin, process.stdout, {
      maxBufferSize: 256 * 1024,
    });
    const handle = serveStdio(
      () => {
        const server = createReferenceServer(reader);
        server.server.onclose = release;
        return server;
      },
      { transport, onerror: (error) => console.error(error.message) },
    );
    const shutdown = () => {
      void handle
        .close()
        .finally(release)
        .catch((error: unknown) => {
          console.error(
            error instanceof Error ? error.message : "MCP shutdown failed.",
          );
          process.exitCode = 1;
        });
    };
    process.stdin.once("end", shutdown);
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    release();
    throw error;
  }
}

try {
  main();
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Unable to start audit reference MCP.",
  );
  process.exitCode = 1;
}
