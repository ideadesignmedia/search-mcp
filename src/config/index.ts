// Optionally load config.json via @ideadesignmedia/config.js when present, but
// only if key envs are not already provided (so CLI flags/env take precedence).
(() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("node:fs");
    if (process.env.MCP_NO_CONFIG === "1") return;
    // If key env is already set, do not load config.json to avoid overwriting.
    if (process.env.SERPER_DEV_API_KEY) return;
    if (fs.existsSync(require("node:path").resolve(process.cwd(), "config.json"))) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("@ideadesignmedia/config.js");
    }
  } catch {
    // Intentionally ignore missing config; environment variables may be provided directly.
  }
})();

export type McpTransport = "stdio" | "http" | "websocket";

export interface SerperConfig {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
}

export interface RuntimeConfig {
  port: number;
  transports: McpTransport[];
  serper: SerperConfig;
}

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const asInteger = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseTransports = (): McpTransport[] => {
  const declared = process.env.MCP_TRANSPORTS;
  if (!declared) return ["stdio"];
  const allowed = new Set<McpTransport>(["stdio", "http", "websocket"]);
  const transports = declared
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is McpTransport => allowed.has(item as McpTransport));
  return transports.length > 0 ? transports : ["stdio"];
};

export const runtimeConfig: RuntimeConfig = {
  port: asInteger(process.env.PORT, 3000),
  transports: parseTransports(),
  serper: {
    apiKey: requireEnv("SERPER_DEV_API_KEY"),
    baseUrl: process.env.SERPER_DEV_BASE_URL ?? "https://google.serper.dev",
    timeoutMs: asInteger(process.env.SERPER_DEV_TIMEOUT_MS, 10_000),
  },
};
