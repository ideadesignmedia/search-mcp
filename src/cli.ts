#!/usr/bin/env node
/*
 Simple CLI to start the MCP server with env/flags so it can be run via npx.
 Supports STDIO over process stdio or file-backed pseudo-stdio streams.
*/

import { McpServer } from "@ideadesignmedia/open-ai.js";
import fs from "node:fs";
import path from "node:path";
import { createSerperClient } from "./services/serperClient";
import { createTools } from "./tools";
import { createFileStdIoStreams } from "./stdio/files";

const parseArgs = (argv: string[]): Record<string, string | boolean> => {
  const out: Record<string, string | boolean> = {};
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const [key, maybeVal] = token.replace(/^--/, "").split("=", 2);
    if (maybeVal !== undefined) {
      out[key] = maybeVal;
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
};

const main = async () => {
  const args = parseArgs(process.argv);

  // Allow setting env via flags (takes precedence over existing env)
  if (typeof args.key === "string") process.env.SERPER_DEV_API_KEY = String(args.key);
  if (typeof args.base === "string") process.env.SERPER_DEV_BASE_URL = String(args.base);
  if (typeof args.timeout === "string") process.env.SERPER_DEV_TIMEOUT_MS = String(args.timeout);
  if (typeof args.port === "string") process.env.PORT = String(args.port);

  // Transports: --http / --websocket / --stdio OR --transports=comma,list
  const transports: string[] = [];
  if (args.transports && typeof args.transports === "string") {
    transports.push(
      ...args.transports
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    );
  } else {
    if (args.http) transports.push("http");
    if (args.websocket || args.ws) transports.push("websocket");
    if (args.stdio) transports.push("stdio");
  }
  if (transports.length > 0) process.env.MCP_TRANSPORTS = transports.join(",");

  const { runtimeConfig } = await import("./config");

  const serperClient = createSerperClient(runtimeConfig.serper);

  // Optional file-backed stdio
  let stdio: { input?: NodeJS.ReadableStream; output?: NodeJS.WritableStream } | undefined;
  const stdioIn = typeof args["stdio-in"] === "string" ? String(args["stdio-in"]) : undefined;
  const stdioOut = typeof args["stdio-out"] === "string" ? String(args["stdio-out"]) : undefined;
  const stdioFilesArg = args["stdio-files"];
  const stdioFiles = typeof stdioFilesArg === "string" ? String(stdioFilesArg) : undefined;
  const wantStdioFiles = !!stdioFilesArg;
  const verbose = !!args["verbose"] || !!args["v"];
  const logFile = ((): string | undefined => {
    if (typeof args["log-file"] === "string") return String(args["log-file"]);
    if (typeof args["logfile"] === "string") return String(args["logfile"]);
    return undefined;
  })();

  let logStream: fs.WriteStream | undefined;
  const log = (message: string, meta?: unknown) => {
    const ts = new Date().toISOString();
    const line = `[${ts}] ${message}${meta !== undefined ? ` ${JSON.stringify(meta)}` : ""}`;
    if (logStream) {
      try { logStream.write(line + "\n"); } catch {}
    }
    if (verbose) {
      // eslint-disable-next-line no-console
      console.error(line);
    }
  };
  let stdioInPath: string | undefined;
  let stdioOutPath: string | undefined;

  if (stdioIn || stdioOut || wantStdioFiles) {
    const tmpDir = path.join(process.cwd(), ".mcp-tmp");
    const prefix = stdioFiles && stdioFiles.trim().length > 0
      ? stdioFiles
      : path.join(tmpDir, `mcp-stdio-${process.pid}`);
    const inPath = stdioIn || `${prefix}.in`;
    const outPath = stdioOut || `${prefix}.out`;
    stdioInPath = inPath;
    stdioOutPath = outPath;
    stdio = createFileStdIoStreams(inPath, outPath);
    if (!process.env.MCP_TRANSPORTS) {
      process.env.MCP_TRANSPORTS = "stdio";
    }
  }

  if (logFile) {
    try {
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
      logStream = fs.createWriteStream(logFile, { flags: "a" });
      log(`logging to file ${logFile}`);
    } catch {
      // eslint-disable-next-line no-console
      console.error(`[mcp] failed to open log file: ${logFile}`);
    }
  }

  process.on("unhandledRejection", (reason) => {
    log("unhandledRejection", { reason: String(reason) });
  });
  process.on("uncaughtException", (err) => {
    log("uncaughtException", { message: err?.message, stack: err?.stack });
  });

  const server = new McpServer({
    port: runtimeConfig.port,
    transports: runtimeConfig.transports,
    tools: createTools(serperClient),
    stdio,
  });

  await server.start();
  const transportsActive = runtimeConfig.transports.join(", ");
  if (runtimeConfig.transports.includes("stdio")) {
    if (verbose) {
      // eslint-disable-next-line no-console
      console.error(`[mcp] transports=${transportsActive}${stdioInPath ? ` stdio-in=${stdioInPath}` : ""}${stdioOutPath ? ` stdio-out=${stdioOutPath}` : ""}`);
    }
    log("server started", { transports: transportsActive, stdioInPath, stdioOutPath });
  } else {
    // eslint-disable-next-line no-console
    console.log(
      `Serper.dev MCP server listening on transports: ${transportsActive}`,
    );
    log("server started", { transports: transportsActive });
  }
};

void main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
