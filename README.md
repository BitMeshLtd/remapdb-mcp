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

## Local Development Config

```json
{
  "mcpServers": {
    "remapdb": {
      "command": "node",
      "args": ["/absolute/path/to/remapdb-mcp/dist/index.js"],
      "env": {
        "REMAPDB_API_KEY": "your_remapdb_api_key",
        "REMAPDB_MCP_URL": "http://127.0.0.1:8082/mcp"
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

## Development

```bash
npm install
npm run typecheck
npm run test
npm run build
```

Run the built CLI locally:

```bash
REMAPDB_API_KEY=your_remapdb_api_key node dist/index.js
```

With a local Remapdb API server:

```bash
REMAPDB_API_KEY=your_remapdb_api_key \
REMAPDB_MCP_URL=http://127.0.0.1:8082/mcp \
node dist/index.js
```

## Publishing

Releases are managed by Release Please on GitHub. Use Conventional Commits on `main`:

- `fix:` creates a patch release
- `feat:` creates a minor release
- `feat!:` or a `BREAKING CHANGE:` footer creates a major release

Release Please opens or updates a release PR that bumps `package.json`, updates `package-lock.json`, updates `CHANGELOG.md`, tags the release, and creates the GitHub release after the release PR is merged.

The GitHub release workflow then publishes to npm when `release_created` is true. Configure the repository secret `NPM_TOKEN` with an npm automation token that can publish `@remapdb/mcp`.

For manual publishing:

```bash
npm login
npm run typecheck
npm run test
npm run build
npm publish --access public
```
