---
title: 'mcp - CLI command'
description: 'Starts the Nx MCP server.'
---

# mcp

Starts the Nx MCP server. The Nx MCP server gives LLMs deep access to your monorepo’s structure as well as Nx Cloud.

## Usage

```shell
nx mcp [workspacePath] [options]
```

## Positionals

### workspacePath, w

Type: `string`

Path to the Nx workspace root. Will default to the current cwd if not provided.

## Options

### transport

Type: `string`
Default: `stdio`
Choices: `stdio`, `sse`, `http`

The transport protocol to use.

### port, p

Type: `number`
Default: `9921`

Port to use for the HTTP/SSE server.

### disableTelemetry

Type: `boolean`
Default: `false`

Disable sending of telemetry data.

### help

Type: `boolean`

Show help.
