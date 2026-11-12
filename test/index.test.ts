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
  it("preserves VRM idempotency keys and shared-balance responses", async () => {
    const message = { jsonrpc: "2.0", id: 12, method: "tools/call", params: {
      name: "lookup_uk_vrm", arguments: { vrm: "AB12CDE", idempotency_key: "lookup-fixture-123" }
    }};
    const result = { jsonrpc: "2.0", id: 12, result: { content: [], structuredContent: {
      status: "estimated", consumption: "none", usage: { included_remaining: 299 }
    }}};
    let calls = 0;
    const fetchImpl: typeof fetch = async (_url, init) => {
      calls++;
      expect(JSON.parse(String(init?.body))).toEqual(message);
      return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
    };
    expect(await forwardMessage(message, { apiKey: "fixture-key", url: "https://example.test/mcp" }, {}, fetchImpl)).toEqual(result);
    expect(calls).toBe(1);
  });

  it("does not retry or replace an idempotency key after a denied VRM tool call", async () => {
    let calls = 0;
    const denied = { jsonrpc: "2.0", id: 13, result: { isError: true, content: [{ type: "text", text: "vrm_access_denied" }] }};
    const fetchImpl: typeof fetch = async () => {
      calls++;
      return new Response(JSON.stringify(denied), { headers: { "content-type": "application/json" } });
    };
    expect(await forwardMessage({ jsonrpc: "2.0", id: 13, method: "tools/call", params: {
      name: "lookup_uk_vrm", arguments: { vrm: "AB12CDE", idempotency_key: "lookup-fixture-123" }
    }}, { apiKey: "fixture-key", url: "https://example.test/mcp" }, {}, fetchImpl)).toEqual(denied);
    expect(calls).toBe(1);
  });

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


describe("DTC and ECU observation forwarding", () => {
  it.each([
    { name: "lookup_dtc", arguments: { code: "P1000", manufacturer: "FORD" } },
    { name: "lookup_dtc_codes", arguments: { codes: ["P0300", "U0001"] } },
    { name: "scan_ecu_maps", arguments: { file_id: "file-id", limit: 20, idempotency_key: "same-on-retry" } },
    { name: "get_ecu_map_grid", arguments: { file_id: "file-id", scan_job_id: "scan-id", map_id: "map-id", idempotency_key: "grid-request" } },
    { name: "get_ecu_result", arguments: { job_id: "job-id", details: true } }
  ])("forwards $name without rewriting IDs or arguments", async (params) => {
    const request = { jsonrpc: "2.0", id: 30, method: "tools/call", params };
    const response = { jsonrpc: "2.0", id: 30, result: { structuredContent: { job_id: "job-id", status: "queued" }, content: [] } };
    let calls = 0;
    const fetchImpl: typeof fetch = async (_url, init) => {
      calls++;
      expect(JSON.parse(String(init?.body))).toEqual(request);
      expect(init?.headers).toMatchObject({ Authorization: "Bearer fixture-key", "Mcp-Session-Id": "fixture-session" });
      return new Response(JSON.stringify(response), { headers: { "content-type": "application/json" } });
    };
    expect(await forwardMessage(request, { apiKey: "fixture-key", url: "http://localhost:8082/mcp" }, { sessionId: "fixture-session" }, fetchImpl)).toEqual(response);
    expect(calls).toBe(1);
  });
  it("preserves denied ECU calls without automatic retries", async () => {
    let calls = 0;
    const response = { jsonrpc: "2.0", id: 31, result: { isError: true, content: [{ type: "text", text: "scope_required" }] } };
    const fetchImpl: typeof fetch = async () => { calls++; return new Response(JSON.stringify(response)); };
    expect(await forwardMessage({ jsonrpc: "2.0", id: 31, method: "tools/call", params: { name: "identify_ecu", arguments: { file_id: "file-id", idempotency_key: "keep-this" } } },
      { apiKey: "fixture-key", url: "http://localhost:8082/mcp" }, {}, fetchImpl)).toEqual(response);
    expect(calls).toBe(1);
  });
});
