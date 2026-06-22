# @remapdb/mcp

`@remapdb/mcp` is a small stdio wrapper for the hosted Remapdb MCP server. It lets MCP clients that only support local stdio commands connect to the remote Remapdb MCP HTTP endpoint.

## Requirements

- Node.js 20 or newer
- A Remapdb MAX plan with an API key

## Usage

```bash
REMAPDB_API_KEY=your_remapdb_api_key npx -y @remapdb/mcp
```

Configuration can come from environment variables:

- `REMAPDB_API_KEY` - required
- `REMAPDB_MCP_URL` - optional, defaults to `https://api.remapdb.com/mcp`

Flags are also supported:

```bash
npx -y @remapdb/mcp --api-key your_remapdb_api_key --url https://api.remapdb.com/mcp
```

## Antigravity / Gemini

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

## Direct HTTP Alternative

Clients that support remote MCP directly do not need this wrapper.

- URL: `https://api.remapdb.com/mcp`
- Header: `Authorization: Bearer <API key>`

## Coding Agent Examples

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

### Antigravity

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
