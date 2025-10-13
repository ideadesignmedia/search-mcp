import '@ideadesignmedia/config.js'
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { McpClient, McpServer } from "@ideadesignmedia/open-ai.js";
import { createTools } from "../src/tools";
import { createSerperClient } from "../src/services/serperClient";

const port = 4510;
const fetchUrl = "https://ideadesignmedia.com";

const apiKey = process.env.SERPER_DEV_API_KEY;
const baseUrl = process.env.SERPER_DEV_BASE_URL ?? "https://google.serper.dev";
const timeout = (() => {
  const declared = process.env.SERPER_DEV_TIMEOUT_MS;
  if (!declared) return 10_000;
  const parsed = Number.parseInt(declared, 10);
  return Number.isFinite(parsed) ? parsed : 10_000;
})();

if (!apiKey) {
  test.skip("SERPER_DEV_API_KEY not set; skipping live Serper integration test");
} else {
  let server: McpServer | undefined;
  let client: McpClient | undefined;

  before(async () => {
    const serperClient = createSerperClient({
      apiKey,
      baseUrl,
      timeoutMs: timeout,
    });

    server = new McpServer({
      port,
      transports: ["http"],
      tools: createTools(serperClient),
    });

    await server.start();

    client = new McpClient({
      transport: "http",
      url: `http://127.0.0.1:${port}/mcp`,
    });

    await client.connect();
    await client.initialize({ name: "integration-tests", version: "1.0.0" });
    await client.sendInitialized();
  });

  after(async () => {
    await client?.disconnect();
    await server?.stop();
  });

  test("serper.dev search and fetch tools respond", async () => {
    assert.ok(client, "client should be initialised");

    const tools = await client!.listTools();
    const toolNames = tools.map((tool) => tool.function?.name ?? tool.name);
    assert.ok(toolNames.includes("serper_search"));
    assert.ok(toolNames.includes("serper_fetch"));

    const searchResult = await client!.callTool("serper_search", {
      query: "Idea Design Media",
      limit: 5,
    });

    assert.ok(searchResult && typeof searchResult === "object", "search should return JSON");

    const fetchResult = await client!.callTool("serper_fetch", {
      url: fetchUrl,
    });

    assert.ok(fetchResult && typeof fetchResult === "object", "fetch should return JSON");
    assert.strictEqual((fetchResult as { url?: string }).url, fetchUrl);
    const content = (fetchResult as { content?: unknown }).content;
    assert.ok(typeof content === "string" && content.length > 0, "fetched content should be text");
  });
}