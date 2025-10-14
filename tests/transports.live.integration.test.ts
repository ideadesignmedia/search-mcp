import "@ideadesignmedia/config.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { McpClient, McpServer } from "@ideadesignmedia/open-ai.js";
import { createSerperClient } from "../src/services/serperClient";
import { createTools } from "../src/tools";
import fs from "node:fs";
import path from "node:path";
import { createFileStdIoStreams, createFileStdIoStreamsForClient } from "../src/stdio/files";

const apiKey = process.env.SERPER_DEV_API_KEY;
const baseUrl = process.env.SERPER_DEV_BASE_URL ?? "https://google.serper.dev";
const timeoutMs = (() => {
  const v = process.env.SERPER_DEV_TIMEOUT_MS;
  const n = v ? Number.parseInt(v, 10) : 15000;
  return Number.isFinite(n) ? n : 15000;
})();

const suiteSkip = !apiKey;
if (suiteSkip) {
  test.skip("SERPER_DEV_API_KEY not set; skipping live transport integration tests");
}

const httpPort = 4620;
const wsPort = 4621;
const fetchUrl = "https://ideadesignmedia.com";

const log = (...args: any[]) => console.error("[test]", ...args);
const time = <T>(label: string, fn: () => Promise<T>): Promise<T> => {
  const start = Date.now();
  return fn().then((res) => {
    const ms = Date.now() - start;
    log(`${label} completed in ${ms}ms`);
    return res;
  });
};

const runToolFlow = async (client: McpClient, ctx: string) => {
  const tools = await time(`${ctx}: listTools`, () => client.listTools());
  const toolNames = tools.map((t) => t.function?.name ?? t.name);
  log(`${ctx}: tools`, toolNames);

  const searchResult = await time(`${ctx}: serper_search`, () =>
    client.callTool("serper_search", {
      query: "Idea Design Media",
      limit: 3,
    }) as Promise<any>,
  );
  assert.ok(searchResult && typeof searchResult === "object");
  const organic = searchResult.organic;
  const kg = searchResult.knowledgeGraph;
  log(`${ctx}: search organic count`, Array.isArray(organic) ? organic.length : 0);
  log(`${ctx}: knowledgeGraph?`, kg ? true : false);

  const fetchResult = (await time(`${ctx}: serper_fetch`, () => client.callTool("serper_fetch", { url: fetchUrl }))) as { url?: string; content?: string; contentParts?: Array<{ type: string; text?: string }> };
  const contentText = Array.isArray(fetchResult.content) && fetchResult.content[0]?.text || "";
  assert.equal(fetchResult.url, fetchUrl);
  assert.ok(typeof contentText === "string" && contentText.length > 0);
  log(`${ctx}: fetch length`, contentText.length);
};

if (!suiteSkip) {
  test("HTTP transport live flow", async () => {
    const serper = createSerperClient({ apiKey: apiKey!, baseUrl, timeoutMs });
    const server = new McpServer({ port: httpPort, transports: ["http"], tools: createTools(serper) });
    await time("http: server.start", () => server.start());

    // exercise auto-detection (omit explicit transport when url is http)
    const client = new McpClient({ url: `http://127.0.0.1:${httpPort}/mcp` });
    await time("http: client.connect", () => client.connect());
    const init = await time("http: initialize", () => client.initialize({ name: "tests", version: "1.0.0" }));
    log("http: initialize result", init);
    await time("http: sendInitialized", () => client.sendInitialized());

    try {
      await runToolFlow(client, "http");
    } finally {
      await time("http: client.disconnect", () => client.disconnect());
      await time("http: server.stop", () => server.stop());
    }
  });

  test("WebSocket transport live flow", async () => {
    const serper = createSerperClient({ apiKey: apiKey!, baseUrl, timeoutMs });
    const server = new McpServer({ port: wsPort, transports: ["websocket"], tools: createTools(serper) });
    await time("ws: server.start", () => server.start());

    // exercise auto-detection (omit explicit transport when url is ws)
    const client = new McpClient({ url: `ws://127.0.0.1:${wsPort}/mcp` });
    await time("ws: client.connect", () => client.connect());
    const init = await time("ws: initialize", () => client.initialize({ name: "tests", version: "1.0.0" }));
    log("ws: initialize result", init);
    await time("ws: sendInitialized", () => client.sendInitialized());

    try {
      await runToolFlow(client, "ws");
    } finally {
      await time("ws: client.disconnect", () => client.disconnect());
      await time("ws: server.stop", () => server.stop());
    }
  });

  test("STDIO transport live flow (file-backed)", async () => {
    const tmpDir = path.join(process.cwd(), ".mcp-tmp");
    fs.mkdirSync(tmpDir, { recursive: true });
    const prefix = path.join(tmpDir, `test-stdio-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const serverIn = `${prefix}.in`;
    const serverOut = `${prefix}.out`;

    const serper = createSerperClient({ apiKey: apiKey!, baseUrl, timeoutMs });
    const serverStdio = createFileStdIoStreams(serverIn, serverOut);
    const server = new McpServer({ transports: ["stdio"], tools: createTools(serper), stdio: serverStdio });
    await time("stdio: server.start", () => server.start());

    const clientStdio = createFileStdIoStreamsForClient(serverIn, serverOut);
    const client = new McpClient({ transport: "stdio", stdio: clientStdio });
    await time("stdio: client.connect", () => client.connect());
    const init = await time("stdio: initialize", () => client.initialize({ name: "tests", version: "1.0.0" }));
    log("stdio: initialize result", init);
    await time("stdio: sendInitialized", () => client.sendInitialized());

    try {
      await runToolFlow(client, "stdio");
    } finally {
      await time("stdio: client.disconnect", () => client.disconnect());
      await time("stdio: server.stop", () => server.stop());
      // best-effort cleanup
      try { (serverStdio.input as any)?.destroy?.(); } catch {}
      try { (serverStdio.output as any)?.end?.(); } catch {}
      try { (clientStdio.input as any)?.destroy?.(); } catch {}
      try { (clientStdio.output as any)?.end?.(); } catch {}
      try { fs.unlinkSync(serverIn); } catch {}
      try { fs.unlinkSync(serverOut); } catch {}
    }
  });
}
