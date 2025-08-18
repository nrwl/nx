---
title: Integrate Nx with your Coding Assistant
description: Set up Nx MCP server to give AI assistants deep workspace context, terminal integration, and enhanced development capabilities.
---

# Integrate Nx with your Coding Assistant

Nx provides deep integration with AI coding assistants through the **Nx Model Context Protocol (MCP) server**, giving your AI assistant comprehensive understanding of your monorepo structure, running processes, and development workflows.

## Setup and Configuration

### Automatic Setup with Nx Console

Make sure you have **Nx Console** [installed in your editor](/getting-started/editor-setup), as it automatically exposes the Nx MCP server.

In VSCode, the MCP server is registered automatically without any further steps required by you. In Cursor or JetBrains IDEs, you will receive a notification to configure the MCP server. Read more under [Setting up Nx MCP](/features/enhance-AI#setting-up-nx-mcp).

### Manual Setup for Other AI Clients

For MCP-compatible clients like **Claude Desktop**, **Cursor**, or other AI assistants, add the following configuration:

```json {% fileName="mcp.json" %}
{
  "servers": {
    "nx-mcp": {
      "command": "npx",
      "args": ["nx-mcp@latest"]
    }
  }
}
```

For Claude Code:

```shell
claude mcp add nx-mcp npx nx-mcp@latest
```

## What This Integration Enables

The Nx AI integration provides your coding assistant with powerful capabilities:

- **[Workspace Structure Understanding](/blog/nx-mcp-vscode-copilot)** - Deep architectural awareness of your monorepo, project relationships, and dependencies
- **[Real-time Terminal Integration](/blog/nx-terminal-integration-ai)** - AI can read your terminal output, running processes, and error messages without copy-pasting
- **[CI Pipeline Context](/blog/nx-editor-ci-llm-integration)** - Access to build failures, test results, and deployment status from your CI/CD processes
- **[Enhanced Code Generation](/blog/nx-generators-ai-integration)** - AI-powered generator suggestions and custom scaffolding with intelligent defaults
- **Cross-project Impact Analysis** - Understanding the implications of changes across your entire monorepo
- **Autonomous Error Debugging** - AI independently accesses context to help fix development issues

Learn more about [why Nx and AI work so well together](/blog/nx-and-ai-why-they-work-together).
