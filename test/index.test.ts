import { describe, expect, it } from "vitest";
import { forwardMessage, parseArgs } from "../src/index.js";

describe("parseArgs", () => {
  it("uses environment variables by default", () => {
    expect(
      parseArgs([], {
        REMAPDB_API_KEY: "env-key",
        REMAPDB_MCP_URL: "http://127.0.0.1:8082/mcp"
      })
    ).toEqual({
      apiKey: "env-key",
      url: "http://127.0.0.1:8082/mcp"
    });
  });

  it("allows flags to override environment variables", () => {
    expect(
      parseArgs(["--api-key", "flag-key", "--url", "https://example.com/mcp"], {
        REMAPDB_API_KEY: "env-key"
      })
    ).toEqual({
      apiKey: "flag-key",
      url: "https://example.com/mcp"
    });
  });

  it("requires an API key without exposing one", () => {
    expect(() => parseArgs([], {})).toThrow("Missing Remapdb API key");
  });
});

describe("forwardMessage", () => {
  it("stores the remote MCP session id and sends it on later requests", async () => {
    const requests: RequestInit[] = [];
    const fetchMock = async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push(init ?? {});
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} }), {
        status: 200,
        headers: { "Mcp-Session-Id": "session-1", "content-type": "application/json" }
      });
    };

    const state = {};
    await forwardMessage(
      { jsonrpc: "2.0", id: 1, method: "initialize" },
      { apiKey: "secret", url: "https://api.remapdb.com/mcp" },
      state,
      fetchMock
    );
    await forwardMessage(
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      { apiKey: "secret", url: "https://api.remapdb.com/mcp" },
      state,
      fetchMock
    );

    expect(requests[0].headers).not.toHaveProperty("Mcp-Session-Id");
    expect(requests[1].headers).toMatchObject({
      "Mcp-Session-Id": "session-1",
      "Mcp-Protocol-Version": "2025-03-26",
      Authorization: "Bearer secret"
    });
  });

  it("converts HTTP errors into JSON-RPC errors", async () => {
    const fetchMock = async () =>
      new Response("unauthorized", {
        status: 401,
        headers: { "content-type": "text/plain" }
      });

    await expect(
      forwardMessage(
        { jsonrpc: "2.0", id: "abc", method: "tools/list" },
        { apiKey: "secret", url: "https://api.remapdb.com/mcp" },
        {},
        fetchMock
      )
    ).resolves.toEqual({
      jsonrpc: "2.0",
      id: "abc",
      error: {
        code: -32000,
        message: "Remote MCP request failed with HTTP 401",
        data: "unauthorized"
      }
    });
  });

  it("passes through remote JSON-RPC error responses", async () => {
    const remoteError = {
      jsonrpc: "2.0",
      id: 3,
      error: { code: -32601, message: "Method not found" }
    };
    const fetchMock = async () =>
      new Response(JSON.stringify(remoteError), {
        status: 400,
        headers: { "content-type": "application/json" }
      });

    await expect(
      forwardMessage(
        { jsonrpc: "2.0", id: 3, method: "missing/method" },
        { apiKey: "secret", url: "https://api.remapdb.com/mcp" },
        {},
        fetchMock
      )
    ).resolves.toEqual(remoteError);
  });
});
