import type {
  ChatCompletionsFunctionTool,
  McpToolHandlerOptions,
} from "@ideadesignmedia/open-ai.js";
import type { SerperClient } from "../services/serperClient";
import { createFetchTool } from "./fetch";
import { createSearchTool } from "./search";

type ToolHandler = McpToolHandlerOptions<ChatCompletionsFunctionTool>;

export const createTools = (client: SerperClient): ReadonlyArray<ToolHandler> => [
  createSearchTool(client),
  createFetchTool(client),
];