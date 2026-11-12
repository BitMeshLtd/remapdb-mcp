# Remapdb MCP Server

Connect your AI tools to Remapdb vehicle tuning data.

Remapdb is a vehicle tuning database platform for tuning businesses, performance workshops, file service providers, dealer networks, and automotive platforms. It helps teams add vehicle lookup, tuning gains, remap stages, quote requests, and API-backed workflows to their websites and internal systems.

This package, `@remapdb/mcp`, is the local stdio bridge for the hosted Remapdb MCP server. It lets MCP clients that run local commands, such as coding agents and desktop AI tools, securely talk to the hosted Remapdb MCP endpoint.

## Why Use MCP With Remapdb?

MCP lets an AI assistant use Remapdb data through structured tools instead of guessing from general knowledge.

With Remapdb MCP connected, your assistant can:

- Search manufacturers, models, generations, and engines.
- Browse vehicle data step by step from type to engine.
- Retrieve engine metadata, OEM performance, tuning stages, ECUs, TCUs, tools, options, and work methods.
- Check the authenticated API key subscription state.
- Use localized vehicle data where a supported language is requested.

This is useful when building automotive apps, answering internal data questions, prototyping quote flows, enriching product catalogs, or working on integrations that need real vehicle tuning data.

## How This Package Works

The actual Remapdb MCP server is hosted at:

```text
https://api.remapdb.com/mcp
```

Some MCP clients can connect to remote HTTP MCP servers directly. Others only support launching a local stdio command. This package handles that local stdio connection and forwards MCP JSON-RPC messages to the hosted Remapdb endpoint with your API key.

## Requirements

- Node.js 20 or newer.
- A Remapdb API key.
- An active Remapdb API or MAX plan for MCP access.
- The API key must have `vdb_read` scope and API access enabled.

You can manage API credentials from the Remapdb app:

- App: https://app.remapdb.com/api
- Website: https://remapdb.com
- API docs: https://docs.remapdb.com/api

Keep your API key out of source control. Store it in your MCP client configuration, shell environment, or secret manager.

## Quick Start

Run the bridge with `npx`:

```bash
REMAPDB_API_KEY=your_remapdb_api_key npx -y @remapdb/mcp
```

If your npm version cannot infer the binary for the scoped package, call the binary explicitly:

```bash
REMAPDB_API_KEY=your_remapdb_api_key npx -y --package @remapdb/mcp remapdb-mcp
```

Most users will not run this command manually. Instead, add it to your MCP client configuration.

## Configuration

Environment variables:

| Variable | Required | Description | Default |
| --- | --- | --- | --- |
| `REMAPDB_API_KEY` | Yes | Remapdb API key used as the bearer token. | None |
| `REMAPDB_MCP_URL` | No | Hosted MCP endpoint URL. | `https://api.remapdb.com/mcp` |

Command-line flags are also supported:

```bash
npx -y @remapdb/mcp --api-key your_remapdb_api_key --url https://api.remapdb.com/mcp
```

Equivalent explicit-binary form:

```bash
npx -y --package @remapdb/mcp remapdb-mcp --api-key your_remapdb_api_key --url https://api.remapdb.com/mcp
```

## MCP Client Setup

### Claude Code

```json
{
  "mcpServers": {
    "remapdb": {
      "command": "npx",
      "args": ["-y", "@remapdb/mcp"],
      "env": {
        "REMAPDB_API_KEY": "your_remapdb_api_key"
      }
    }
  }
}
```

### Codex

```toml
[mcp_servers.remapdb]
command = "npx"
args = ["-y", "@remapdb/mcp"]

[mcp_servers.remapdb.env]
REMAPDB_API_KEY = "your_remapdb_api_key"
```

### Gemini / Antigravity

```json
{
  "mcpServers": {
    "remapdb": {
      "command": "npx",
      "args": ["-y", "@remapdb/mcp"],
      "env": {
        "REMAPDB_API_KEY": "your_remapdb_api_key"
      }
    }
  }
}
```

### OpenCode

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "remapdb": {
      "type": "local",
      "command": ["npx", "-y", "@remapdb/mcp"],
      "environment": {
        "REMAPDB_API_KEY": "your_remapdb_api_key"
      }
    }
  }
}
```

## Available Tools

The hosted Remapdb MCP server exposes catalog, DTC, entitled UK VRM and enabled ECU observation tools. Registration lookups can consume shared lookup balance. Tool availability follows the backend deployment; the bridge forwards tool discovery dynamically.

| Tool | What it does |
| --- | --- |
| `search_vehicles` | Searches manufacturers, models, generations, and engines. |
| `list_vehicle_types` | Lists available Remapdb vehicle types. |
| `list_manufacturers` | Lists manufacturers for a vehicle type. |
| `list_models` | Lists models for a manufacturer. |
| `list_generations` | Lists generations for a model. |
| `list_engines` | Lists engines for a generation. |
| `get_engine` | Gets detailed engine and tuning information. |
| `get_subscription` | Shows API key scopes, call limit, MCP/UK VRM access and configured monthly lookup allowance. |
| `lookup_uk_vrm` | Looks up a UK registration, vehicle details and available tuning data; requires VRM entitlement and an idempotency key. |
| `get_uk_vrm_usage` | Shows the shared lookup allowance, usage, remaining balance and reset time without consuming a lookup. |

UK VRM tools require an active **API** or **MAX** full API subscription and `subscription.uk_vrm_access=true`. Trial API credentials never grant VRM API or MCP access, including trials on paid Plus/Pro widget plans.

`lookup_uk_vrm` takes `vrm`, a required `idempotency_key` (8–128 letters, digits, `.`, `_`, `:`, or `-`), and optional `language`. Generate a unique key per lookup and reuse it for retries. A successful uncached lookup consumes one included lookup, or one purchased lookup after the monthly allowance. Cached results consume nothing. REST, MCP and widgets share the same balance and account idempotency namespace. Do not automatically retry a failed lookup with a new key.

`get_subscription` exposes `mcp_access`, `uk_vrm_access`, `uk_vrm_limit` and `uk_vrm_remaining` inside `subscription`. `uk_vrm_limit` includes the current period allowance and unspent top-ups; `uk_vrm_remaining` is the spendable balance after usage and reservations. Use `get_uk_vrm_usage` for the breakdown and reset time. Entitlements are rechecked on every request, including existing MCP sessions.

Several tools accept an optional `language` argument. If it is not provided, Remapdb uses the request `Accept-Language` value where available, or the API default language.

Search and manufacturer listing tools support pagination with `cursor` and `limit`. Limits must be between `1` and `100`.


## DTC and ECU tools

DTC lookup is included on every active API/MAX full API subscription with `vdb_read`. It is synchronous, uses no lookup credits and needs no ECU enablement.

| Tool | Purpose |
|---|---|
| `lookup_dtc` | One code, optional manufacturer token. |
| `lookup_dtc_codes` | 1–20 codes in input order; unknown codes return `found:false`. |
| `search_dtc_codes` | Search/browse by query, manufacturer, type and scope; limit 1–100 and offset pagination. |
| `list_dtc_manufacturers` | Available manufacturer tokens and counts. |

Use tokens from `list_dtc_manufacturers`, such as `FORD`. With context, lookup returns that maker plus generic references. Without it, meanings remain separate. A generic reference does not prove universal vehicle applicability. Definitions are not diagnoses, are returned as stored and are not translated.

ECU observation additionally requires enabled ECU access. Submission/deletion requires `ecu_observe`; reading requires `ecu_read`. MCP also requires `vdb_read` for the connection.

| Tool | Purpose |
|---|---|
| `get_ecu_capabilities` | Operations, limits, retention. |
| `identify_ecu` | Queue identification; returns a job ID. |
| `inspect_ecu` | Queue combined observations. |
| `scan_ecu_maps` | Queue candidate-map scan. |
| `get_ecu_map_grid` | Queue extraction of a detected map's raw cells. |
| `compare_ecu_files` | Queue byte and map comparison of two uploads. |
| `get_ecu_job` | Poll status and compact result. |
| `get_ecu_result` | Compact result by default; `details:true` for maps, grids and comparison details. |
| `delete_ecu_file` | Explicitly requested deletion of an uploaded file. |

Upload through REST `POST /v2/ecu/files` first. The bridge accepts server-issued file IDs, not local paths, URLs or binary data. Reuse the same `idempotency_key` on retry; REST and MCP share the namespace. Poll at least 2 seconds apart. Completed identification includes confidence levels; unknown identity remains unknown. Observation does not modify firmware or establish stock/tuned status.

For a grid:

1. Submit `scan_ecu_maps` with the uploaded `file_id` and a unique `idempotency_key`.
2. Poll `get_ecu_job` using its returned `job_id` until completed.
3. Call `get_ecu_result` with that job ID and `details:true`; choose a `maps.items[].map_id`.
4. Submit `get_ecu_map_grid` with the original `file_id`, scan's job ID as `scan_job_id`, selected `map_id`, and a new idempotency key.
5. Poll the new job, then retrieve its details for `grid.values`. Units/scaling can be unknown.

### Testing against the local API

Build the bridge with `npm run build`, then configure your MCP client to run `node /absolute/path/remapdb-mcp/dist/index.js` with `REMAPDB_MCP_URL=http://localhost:8082/mcp` and your local `REMAPDB_API_KEY`. Reconnect after changing backend tool registrations. The production URL remains the default. No bridge runtime change is necessary for these new tools; the backend must be deployed before hosted clients see them.

## Example Prompts

After you connect the MCP server, try prompts like:

```text
Search Remapdb for Audi A4 2.0 TDI engines.
```

```text
Find the engine details and available remap stages for engine ID 123.
```

```text
List vehicle types in Remapdb, then show manufacturers for the passenger car type.
```

```text
Use Remapdb to compare available tuning data for BMW 320d generations.
```

The exact tool calls are handled by your MCP client or AI assistant.

## Direct HTTP Alternative

If your MCP client supports remote streamable HTTP MCP servers, you can connect directly without this stdio package.

- URL: `https://api.remapdb.com/mcp`
- Header: `Authorization: Bearer <API key>`
- Protocol version header: `Mcp-Protocol-Version: 2025-03-26`

Use this package only when your client expects a local command.

## Troubleshooting

### Missing API Key

If the bridge exits with a missing key error, set `REMAPDB_API_KEY` or pass `--api-key`.

### Invalid API Key

Confirm the value matches the API key shown in the Remapdb app. If credentials were rotated, update every MCP client configuration that uses the old key.

### MCP Access Is Not Available

MCP access requires the MAX or API plan. API access must also be enabled and active for the subscription.

If your MCP client reports that handshaking failed during `initialize`, test the bridge manually. A response like this means the package started correctly, but the Remapdb subscription/API key is not allowed to use MCP yet:

```json
{
  "error": {
    "message": "API access is not enabled for this subscription."
  }
}
```

Enable API access for the subscription, switch to an API or MAX plan, or use a key from an account that already has MCP access.

### Not Enough Permissions

The API key needs the `vdb_read` scope.

### Node or npx Cannot Start

MCP clients may launch commands without loading your interactive shell profile. If you use `nvm`, `asdf`, or another version manager, use an absolute command path in the MCP client config:

```toml
[mcp_servers.remapdb]
command = "/Users/you/.nvm/versions/node/v22.0.0/bin/npx"
args = ["-y", "@remapdb/mcp"]
```

Node.js 20 or newer is required.

### Rate Limit Reached

Remapdb applies API key limits. Wait for the limit window to reset or review your subscription/API usage settings.

## Development

Install dependencies and run checks:

```bash
npm install
npm run typecheck
npm test
npm run build
```

## Links

- Remapdb website: https://remapdb.com
- Remapdb app: https://app.remapdb.com
- Remapdb API settings: https://app.remapdb.com/api
- Remapdb docs: https://docs.remapdb.com
- Hosted MCP endpoint: https://api.remapdb.com/mcp

## License

MIT
