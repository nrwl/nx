---
title: 'Enhance Your LLM'
description: 'Learn how Nx enhances your AI assistant by providing rich workspace metadata, architectural insights, and project relationships to make your LLM smarter and more context-aware.'
---

# Enhance Your LLM

Nx's LLM enhancement feature makes your AI assistant significantly smarter by providing it with rich metadata about your workspace structure, project relationships, and architectural decisions. While LLMs are powerful tools for boosting development productivity, their effectiveness depends entirely on the context they have access to. Nx bridges this gap by:

- Providing **architectural awareness** about your workspace structure and project relationships
- Feeding information about **project ownership and team responsibilities**
- Sharing knowledge about **available tasks** and their configuration
- Including details about **technology stacks** and project types
- Supplying **Nx documentation** context for better assistance

{% side-by-side %}
{% youtube src="https://youtu.be/RNilYmJJzdk?si=et_6zWMMxJPa7lp2" title="We Just Made Your LLM Way Smarter!" /%}

{% youtube src="https://www.youtube.com/watch?v=V2W94Sq_v6A" title="We Just Released the MCP Server for Monorepos" /%}
{% /side-by-side %}

## How It Works

![Nx Console LLM Enhancement](/shared/images/nx-enhance-llm-illustration.avif)

Nx maintains comprehensive metadata about your workspace to power features like [caching](/features/cache-task-results) and [distributed task execution](/ci/features/distribute-task-execution). Nx Console, as an editor extension, hooks into this rich metadata, post-processes it, and feeds it directly to your LLM. This enables your LLM to:

- Understand the complete workspace structure, including applications and libraries
- Know how different projects are connected and their dependency relationships
- Recognize project technology stacks and available tasks
- Access information about project ownership and team responsibilities
- Utilize Nx documentation to provide more accurate assistance

This enhanced context allows your LLM to move beyond simple file-level operations to understand your workspace at an architectural level, making it a more effective development partner.

{% callout type="note" title="Current Support" %}
LLM enhancement is available for VS Code with GitHub Copilot, Cursor, and other LLM clients through the MCP server. Support for additional editors and LLM providers continues to expand.
{% /callout %}

## Setting Up LLM Enhancements

### VS Code with GitHub Copilot

To enable LLM enhancement in VS Code:

1. Install or update [Nx Console](/getting-started/editor-setup) in VS Code
2. Ensure you have GitHub Copilot installed and configured
3. Start using Copilot in your Nx workspace by typing `@nx` at the beginning of your prompt - this will automatically provide the enhanced context

![Example of @nx chat participant in VSCode](/shared/images/nx-chat-participant.avif)

### Cursor

To enable LLM enhancements in Cursor:

1. Install or update [Nx Console](/getting-started/editor-setup) and make sure you're on the latest version of Cursor (0.46 and up)
2. When starting Cursor, you will see a notification prompting you to add the Nx enhancement to Cursor Agents. Accept the notification. Alternatively, you can execute the `nx.configureMcpServer` command. ![Screenshot of the Nx AI notification](/shared/images/cursor-ai-notification.avif)
3. Make sure the MCP server is enabled under `Cursor` -> `Settings` -> `Cursor Settings` -> `MCP` ![Screenshot of the Cursor MCP settings page](/shared/images/cursor-mcp-settings.avif)
4. You have now successfully configured an [MCP server](https://modelcontextprotocol.io/introduction) that provides the enhanced context to Cursor's AI features ![Example of Cursor Agent using Nx tools](/shared/images/cursor-mcp-example.avif)

### Other LLM Clients

Other LLM clients like Claude Desktop can use the MCP server as well:

1. Run `npx nx-mcp /path/to/workspace` to start the MCP server for your workspace
2. The MCP server will provide the necessary context to your LLM client when interacting with your Nx workspace

## Key Benefits

- **Architectural Understanding** - Your LLM gains deep insight into your workspace structure, identifying applications, libraries, and their relationships. It understands project categorization through tags and can make informed suggestions about feature implementation.

- **Team and Ownership Awareness** - Access to project ownership information allows the LLM to identify relevant team members for collaboration and provide guidance on who to consult for specific components.

- **Task and Generator Knowledge** - Enhanced context about workspace tasks and generators enables the LLM to suggest appropriate commands, help set up new projects, and provide guidance on available tasks and their configuration.

Here are some example queries:

Ask your LLM about your workspace structure and get detailed, accurate responses:

![Example of LLM understanding project structure](/blog/images/articles/nx-ai-example-project-data.avif)

Get informed suggestions about where to implement new functionality based on existing code:

![Example of LLM providing implementation guidance](/blog/images/articles/nx-ai-example-data-access-feature.avif)

Identify relevant team members and ownership information:

![Example of LLM providing ownership information](/blog/images/articles/nx-ai-example-ownership.avif)

Get assistance with creating new projects using Nx generators:

![Example of LLM helping with code generation](/blog/images/articles/nx-ai-example-generate-code.avif)

## Learn More

For a deeper dive into how Nx's monorepo approach enhances AI capabilities and makes your workspace future-proof, read our blog post [Nx Just Made Your LLM Way Smarter](/blog/nx-just-made-your-llm-smarter). The post explores:

- How monorepos break down barriers for both teams and LLMs
- Why Nx's metadata is a goldmine for enhancing AI capabilities
- How this positions your workspace for future AI advancements
