import type {
  ChatCompletionsFunctionTool,
  InferToolArguments,
  McpToolHandlerOptions,
} from "@ideadesignmedia/open-ai.js";
import type {
  SerperClient,
  SerperSearchResponse,
} from "../services/serperClient";

const searchDefinition: ChatCompletionsFunctionTool = {
  type: "function",
  function: {
    name: "serper_search",
    description: "Query the Serper.dev Search API for relevant results.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search terms to send to Serper.dev.",
        },
        limit: {
          type: "integer",
          description: "Maximum number of organic results to return (1-10).",
          minimum: 1,
          maximum: 10,
        },
        language: {
          type: "string",
          description: "Optional language hint (e.g. en).",
        },
        country: {
          type: "string",
          description: "Optional country code (e.g. us).",
        },
        autocorrect: {
          type: "boolean",
          description: "Toggle Serper autocorrect suggestions.",
        },
      },
      required: ["query"],
    },
  },
};

type SearchArguments = InferToolArguments<typeof searchDefinition>;

export const createSearchTool = (
  client: SerperClient,
): McpToolHandlerOptions<typeof searchDefinition> => ({
  tool: searchDefinition,
  handler: async (args: SearchArguments): Promise<SerperSearchResponse & { content: Array<{ type: string; json?: unknown; text?: string }> }> => {
    const { query, limit, language, country, autocorrect } = args;

    if (typeof query !== "string" || query.trim().length === 0) {
      throw new Error("`query` must be a non-empty string.");
    }

    const results = await client.search(query, {
      limit: typeof limit === "number" ? limit : undefined,
      language: typeof language === "string" ? language : undefined,
      country: typeof country === "string" ? country : undefined,
      autocorrect: typeof autocorrect === "boolean" ? autocorrect : undefined,
    });

    // Return structured content per typical assistant tool expectations
    return {
      ...results,
      content: [
        { type: "text", text: JSON.stringify(results) },
      ],
    };
  },
});

