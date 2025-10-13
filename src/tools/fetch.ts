import type {
  ChatCompletionsFunctionTool,
  InferToolArguments,
  McpToolHandlerOptions,
} from "@ideadesignmedia/open-ai.js";
import type { SerperClient } from "../services/serperClient";

const fetchDefinition: ChatCompletionsFunctionTool = {
  type: "function",
  function: {
    name: "serper_fetch",
    description: "Fetch the raw content for a Serper.dev search result URL.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Absolute URL returned by the Serper search tool.",
        },
      },
      required: ["url"],
    },
  },
};

type FetchArguments = InferToolArguments<typeof fetchDefinition>;

export const createFetchTool = (
  client: SerperClient,
): McpToolHandlerOptions<typeof fetchDefinition> => ({
  tool: fetchDefinition,
  handler: async (args: FetchArguments) => {
    const { url } = args;

    if (typeof url !== "string" || url.trim().length === 0) {
      throw new Error("`url` must be a non-empty string.");
    }

    const content = await client.fetchResultContent(url);
    return { url, content };
  },
});