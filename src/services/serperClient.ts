/// <reference path="../types/ideadesignmedia__request.d.ts" />
import { request as httpRequest } from "@ideadesignmedia/request";
import { Buffer } from "node:buffer";
import type { JsonRecord, JsonValue } from "@ideadesignmedia/open-ai.js";
import type { SerperConfig } from "../config";

export interface SearchOptions {
  limit?: number;
  language?: string;
  country?: string;
  autocorrect?: boolean;
}

export interface SerperOrganicResult extends JsonRecord {
  title?: string;
  link?: string;
  snippet?: string;
  position?: number;
  sitelinks?: JsonValue;
  date?: string;
}

export interface SerperSearchResponse extends JsonRecord {
  searchParameters?: JsonRecord;
  organic?: SerperOrganicResult[];
  knowledgeGraph?: JsonRecord;
  peopleAlsoAsk?: JsonRecord[];
  relatedSearches?: JsonRecord[];
}

export interface SerperClient {
  search(query: string, options?: SearchOptions): Promise<SerperSearchResponse>;
  fetchResultContent(url: string): Promise<string>;
}

export type RequestFunction = (
  url?: string,
  options?: Record<string, unknown>,
  data?: unknown,
) => Promise<unknown>;

const isJsonRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null;

const isBuffer = (value: unknown): value is Buffer =>
  typeof Buffer !== "undefined" && value instanceof Buffer;

const coerceJsonRecordArray = (value: JsonValue | undefined): JsonRecord[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value.filter(isJsonRecord);
};

const coerceOrganicResults = (value: JsonValue | undefined): SerperOrganicResult[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SerperOrganicResult => isJsonRecord(item));
};

export const createSerperClient = (
  config: SerperConfig,
  requestFn: RequestFunction = httpRequest,
): SerperClient => {
  const buildHeaders = (): Record<string, string> => ({
    "X-API-KEY": config.apiKey,
    "Content-Type": "application/json",
  });

  const buildBody = (query: string, options: SearchOptions): JsonRecord => {
    const payload: JsonRecord = { q: query };

    if (typeof options.limit === "number") {
      const num = Math.min(Math.max(options.limit, 1), 10);
      payload.num = num;
    }

    if (typeof options.language === "string" && options.language.trim()) {
      payload.hl = options.language.trim();
    }

    if (typeof options.country === "string" && options.country.trim()) {
      payload.gl = options.country.trim();
    }

    if (typeof options.autocorrect === "boolean") {
      payload.autocorrect = options.autocorrect;
    }

    return payload;
  };

  const postJson = async (path: string, body: JsonRecord): Promise<unknown> => {
    const url = new URL(path, config.baseUrl).toString();
    return requestFn(url, { method: "POST", headers: buildHeaders() }, body);
  };

  return {
    async search(query, options = {}) {
      if (typeof query !== "string" || query.trim().length === 0) {
        throw new Error("Search query must be a non-empty string.");
      }

      const payload = await postJson("/search", buildBody(query, options));

      if (isBuffer(payload)) {
        throw new Error("Unexpected binary response from Serper search endpoint.");
      }

      if (!isJsonRecord(payload)) {
        throw new Error("Serper search response was not a JSON object.");
      }

      const searchParameters = isJsonRecord(payload.searchParameters)
        ? payload.searchParameters
        : undefined;

      const organic = coerceOrganicResults(payload.organic);
      const knowledgeGraph = isJsonRecord(payload.knowledgeGraph)
        ? payload.knowledgeGraph
        : undefined;
      const peopleAlsoAsk = coerceJsonRecordArray(payload.peopleAlsoAsk);
      const relatedSearches = coerceJsonRecordArray(payload.relatedSearches);

      return {
        searchParameters,
        organic,
        knowledgeGraph,
        peopleAlsoAsk,
        relatedSearches,
      };
    },

    async fetchResultContent(url) {
      if (typeof url !== "string" || url.trim().length === 0) {
        throw new Error("URL must be a non-empty string.");
      }

      const response = await requestFn(url, { method: "GET" });

      if (isBuffer(response)) {
        return response.toString("utf-8");
      }

      if (typeof response === "string") {
        return response;
      }

      if (isJsonRecord(response)) {
        return JSON.stringify(response);
      }

      return String(response ?? "");
    },
  };
};
