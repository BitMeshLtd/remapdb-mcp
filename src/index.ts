#!/usr/bin/env node
import { createInterface } from "node:readline";
import { stdin, stdout, stderr, exit } from "node:process";

const DEFAULT_MCP_URL = "https://api.remapdb.com/mcp";
const MCP_PROTOCOL_VERSION = "2025-03-26";

type JsonRpcId = string | number | null;

type JsonRpcMessage = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: unknown;
};

type Config = {
  apiKey: string;
  url: string;
};

type BridgeState = {
  sessionId?: string;
};

type FetchLike = typeof fetch;

export function parseArgs(argv: string[], env: NodeJS.ProcessEnv): Config {
  let apiKey = env.REMAPDB_API_KEY;
  let url = env.REMAPDB_MCP_URL ?? DEFAULT_MCP_URL;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--api-key") {
      apiKey = readFlagValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--url") {
      url = readFlagValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      throw new UsageRequested();
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (!apiKey) {
    throw new Error(
      "Missing Remapdb API key. Set REMAPDB_API_KEY or pass --api-key <key>."
    );
  }

  try {
    new URL(url);
  } catch {
    throw new Error("Invalid Remapdb MCP URL. Set REMAPDB_MCP_URL or pass --url <url>.");
  }

  return { apiKey, url };
}

export async function forwardMessage(
  message: JsonRpcMessage,
  config: Config,
  state: BridgeState,
  fetchImpl: FetchLike = fetch
): Promise<JsonRpcMessage | undefined> {
  const response = await fetchImpl(config.url, {
    method: "POST",
    headers: buildHeaders(config.apiKey, state.sessionId),
    body: JSON.stringify(message)
  });

  const sessionId = response.headers.get("Mcp-Session-Id");
  if (sessionId) {
    state.sessionId = sessionId;
  }

  const body = await response.text();

  const parsed = parseResponseBody(body, response.headers.get("content-type") ?? undefined);

  if (!response.ok) {
    if (isJsonRpcMessage(parsed)) {
      return parsed;
    }

    return makeErrorResponse(
      message.id,
      -32000,
      `Remote MCP request failed with HTTP ${response.status}`,
      parsed
    );
  }

  if (response.status === 202 || body.trim() === "") {
    return undefined;
  }

  if (isJsonRpcMessage(parsed)) {
    return parsed;
  }

  return makeErrorResponse(
    message.id,
    -32603,
    "Remote MCP server returned an invalid JSON-RPC response"
  );
}

function buildHeaders(apiKey: string, sessionId: string | undefined): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "Mcp-Protocol-Version": MCP_PROTOCOL_VERSION
  };

  if (sessionId) {
    headers["Mcp-Session-Id"] = sessionId;
  }

  return headers;
}

function parseResponseBody(body: string, contentType = ""): unknown {
  const trimmed = body.trim();
  if (!trimmed) {
    return undefined;
  }

  if (contentType.includes("text/event-stream") || trimmed.startsWith("event:")) {
    return parseSseJson(trimmed);
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function parseSseJson(body: string): unknown {
  const dataLines = body
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .filter(Boolean);

  for (const data of dataLines) {
    if (data === "[DONE]") {
      continue;
    }

    try {
      return JSON.parse(data);
    } catch {
      continue;
    }
  }

  return undefined;
}

function isJsonRpcMessage(value: unknown): value is JsonRpcMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "jsonrpc" in value &&
    (value as JsonRpcMessage).jsonrpc === "2.0"
  );
}

function makeErrorResponse(
  id: JsonRpcId | undefined,
  code: number,
  message: string,
  data?: unknown
): JsonRpcMessage | undefined {
  if (id === undefined) {
    return undefined;
  }

  return {
    jsonrpc: "2.0",
    id,
    error: data === undefined ? { code, message } : { code, message, data }
  };
}

function readFlagValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function printUsage(): void {
  stderr.write(`Usage: remapdb-mcp [--api-key <key>] [--url <url>]

Environment:
  REMAPDB_API_KEY   Required Remapdb API key
  REMAPDB_MCP_URL   Optional MCP endpoint URL (default: ${DEFAULT_MCP_URL})
`);
}

class UsageRequested extends Error {}

async function run(): Promise<void> {
  let config: Config;

  try {
    config = parseArgs(process.argv.slice(2), process.env);
  } catch (error) {
    if (error instanceof UsageRequested) {
      printUsage();
      exit(0);
    }

    stderr.write(`${error instanceof Error ? error.message : "Invalid configuration"}\n`);
    exit(1);
  }

  const state: BridgeState = {};
  const lines = createInterface({ input: stdin, crlfDelay: Infinity });

  for await (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    let message: JsonRpcMessage;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (!isJsonRpcMessage(parsed)) {
        stdout.write(
          `${JSON.stringify(makeErrorResponse(null, -32600, "Invalid JSON-RPC message"))}\n`
        );
        continue;
      }
      message = parsed;
    } catch {
      stdout.write(`${JSON.stringify(makeErrorResponse(null, -32700, "Parse error"))}\n`);
      continue;
    }

    try {
      const response = await forwardMessage(message, config, state);
      if (response) {
        stdout.write(`${JSON.stringify(response)}\n`);
      }
    } catch (error) {
      const response = makeErrorResponse(
        message.id,
        -32000,
        error instanceof Error ? error.message : "Remote MCP request failed"
      );
      if (response) {
        stdout.write(`${JSON.stringify(response)}\n`);
      }
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((error) => {
    stderr.write(`${error instanceof Error ? error.message : "Unexpected failure"}\n`);
    exit(1);
  });
}
