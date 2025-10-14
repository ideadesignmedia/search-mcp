import { McpServer } from "@ideadesignmedia/open-ai.js";
import { runtimeConfig } from "./config";
import { createSerperClient } from "./services/serperClient";
import { createTools } from "./tools";

const startServer = async (): Promise<void> => {
  const serperClient = createSerperClient(runtimeConfig.serper);
  const server = new McpServer({
    port: runtimeConfig.port,
    transports: runtimeConfig.transports,
    tools: createTools(serperClient),
  });

  await server.start();
  // Avoid stdout noise when running under stdio transport
  if (!runtimeConfig.transports.includes("stdio")) {
    console.log(
      `Serper.dev MCP server listening on transports${runtimeConfig.port ? ` (PORT: ${runtimeConfig.port})` : ''}: ${runtimeConfig.transports.join(", ")}`,
    );
  }
};

void startServer().catch((error) => {
  console.error("Failed to start the Serper.dev MCP server", error);
  process.exitCode = 1;
});
