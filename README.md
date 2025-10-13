# Serper.dev MCP Server (search-mcp)

TypeScript MCP server exposing two tools backed by Serper.dev:
- `serper_search`: Google Search via Serper.dev
- `serper_fetch`: Fetch raw content for a result URL

The server is built with `@ideadesignmedia/open-ai.js` (MCP server/client helpers), uses `@ideadesignmedia/request` for HTTP, and loads configuration via `@ideadesignmedia/config.js`.

## Requirements
- Node.js 18+ (recommended 20+)
- Yarn (or npm)
- Serper.dev API key

## Install
- `yarn install`

## Configure
`@ideadesignmedia/config.js` loads `config.json` at the project root and maps entries to `process.env`.

1) Copy the sample and fill in values:
- PowerShell: `Copy-Item config-sample.json config.json`
- Bash: `cp config-sample.json config.json`

2) Set required values in `config.json`:
- `SERPER_DEV_API_KEY` (required)
- `SERPER_DEV_BASE_URL` (default `https://google.serper.dev`)
- `SERPER_DEV_TIMEOUT_MS` (default `10000`)
- `MCP_TRANSPORTS` one or more of `stdio,http,websocket` (default `stdio`)
- `PORT` HTTP/WS port (default 3000 if unset)

## Run
- Dev (TypeScript): `yarn dev`
- Build: `yarn build`
- Start (compiled): `yarn start`

Transports
- HTTP: set `MCP_TRANSPORTS` to include `http` (and optionally `websocket`); server listens on `http://localhost:PORT/mcp`.
- STDIO: use default `MCP_TRANSPORTS=stdio` when launched by an MCP‑compatible client via stdio. Note: avoid printing to stdout when embedding in stdio clients.

## Quickstart
- PowerShell
  - `Copy-Item config-sample.json config.json`
  - `$env:SERPER_DEV_API_KEY = 'your-serper-key'`
  - `$env:MCP_TRANSPORTS = 'http'`  (or `stdio`)
  - `$env:PORT = '4510'`
  - `yarn dev` (or `yarn build && yarn start`)

- Bash
  - `cp config-sample.json config.json`
  - `export SERPER_DEV_API_KEY='your-serper-key'`
  - `export MCP_TRANSPORTS=http`  (or `stdio`)
  - `export PORT=4510`
  - `yarn dev` (or `yarn build && yarn start`)

When running with `MCP_TRANSPORTS=http`, you can connect an MCP client to `http://localhost:$PORT/mcp`.

### NPX
- After publishing this package to npm (name `search-mcp`), you can run:
  - HTTP: `npx search-mcp --http --port 4510 --key $SERPER_DEV_API_KEY`
  - STDIO (process stdio): `npx search-mcp --stdio --key $SERPER_DEV_API_KEY`
- STDIO (file-backed): `npx search-mcp --stdio --stdio-files` (creates `./mcp-stdio.in/.out`)
  - Optional logging: add `--log-file ./server.log` and/or `--verbose` (stderr)

Flags
- `--key` sets `SERPER_DEV_API_KEY`
- `--base` sets `SERPER_DEV_BASE_URL` (default `https://google.serper.dev`)
- `--timeout` sets `SERPER_DEV_TIMEOUT_MS`
- `--port` sets `PORT`
- `--http`/`--websocket`/`--stdio` choose transports (or `--transports=http,websocket`)

Notes for STDIO:
- Logging goes to stderr by default; add `--verbose` to see a one-line startup message (safe for stdio).
- File-backed STDIO uses two files for JSON-RPC: `*.in` (client→server) and `*.out` (server→client). Pass custom paths via `--stdio-in` and `--stdio-out`.
- Avoid printing to stdout; use stderr or `--verbose` for a minimal status line.
- To force skipping config.json: set `MCP_NO_CONFIG=1`.
- To write logs to a file: `--log-file ./server.log` (safe in all transports)

## Tools
- `serper_search`
  - params: `{ query: string; limit?: number; language?: string; country?: string; autocorrect?: boolean }`
  - returns Serper organic results and related sections (JSON)
- `serper_fetch`
  - params: `{ url: string }`
  - returns `{ url, content }` where `content` is raw text/HTML

## Testing
- Type checks: `yarn typecheck`
- Live integration test (HTTP transport):
  - Ensure `SERPER_DEV_API_KEY` is set in `config.json` or the environment
  - Run: `yarn test`
  - The test starts the server on a test port, uses `McpClient` to call `serper_search` ("Idea Design Media") and `serper_fetch` (ideadesignmedia.com), and asserts non‑empty responses.

## Project Layout
- `src/server.ts` – boots the MCP server
- `src/config/` – runtime config (reads env via `config.json`)
- `src/services/serperClient.ts` – Serper client using `@ideadesignmedia/request`
- `src/tools/` – MCP tools (`serper_search`, `serper_fetch`)
- `tests/serper.mcp.integration.test.ts` – live MCP client integration test
