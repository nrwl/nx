---
title: 'Making Cursor Smarter with an MCP Server For Nx Monorepos'
slug: nx-made-cursor-smarter
authors: ['Juri Strumpflohner', 'Max Kless']
tags: ['nx']
cover_image: /blog/images/articles/cursor-nx-mcp-heroimg.jpg
description: 'Learn how Nx enhances Cursor IDE with a dedicated MCP server, providing AI assistants with rich monorepo metadata for smarter code assistance.'
youtubeUrl: https://youtu.be/V2W94Sq_v6A
---

{% callout type="deepdive" title="Series: Making your LLM smarter" expanded=true %}

- [Nx Just Made Your LLM Way Smarter](/blog/nx-just-made-your-llm-smarter)
- **Making Cursor Smarter with an MCP Server For Nx Monorepos**
- [Nx MCP Now Available for VS Code Copilot](/blog/nx-mcp-vscode-copilot)
- [Nx and AI: Why They Work so Well Together](/blog/nx-and-ai-why-they-work-together)
- [Save Time: Connecting Your Editor, CI and LLMs](/blog/nx-editor-ci-llm-integration)
- [Enhancing Nx Generators with AI: Predictability Meets Intelligence](/blog/nx-generators-ai-integration)
- [Your AI Assistant Can Now Read Your Terminal: Real-Time Development Error Fixing](/blog/nx-terminal-integration-ai)

{% /callout %}

A couple of weeks ago, we [announced how Nx makes your LLM smarter](/blog/nx-just-made-your-llm-smarter) by providing rich metadata about your monorepo structure, project relationships, and architectural context. This enhancement was initially available through GitHub Copilot in VSCode, but now we're taking it a step further by implementing the Model Context Protocol (MCP) for Cursor, making your AI assistant even more powerful.

{% call-to-action title="Learn more about Nx and AI" url="https://go.nx.dev/march2025-webinar" description="LLM-focused Webinar on March 19th" /%}

{% toc /%}

## What is the Model Context Protocol (MCP)?

The Model Context Protocol is an open standard - pioneered by [Anthropic](https://www.anthropic.com/) - that enables AI models to interact with your development environment in a more structured and powerful way. It provides a standardized interface for tools and resources that can be used by AI assistants to better understand and interact with your codebase.

![mcp-architecture.avif](/blog/images/articles/mcp-architecture.avif)

_(Source: [Official MCP documentation](https://modelcontextprotocol.io))_

According to the [MCP documentation](https://modelcontextprotocol.io/introduction), it's designed to:

- Provide structured access to development tools and resources
- Enable AI models to take actions in your development environment
- Create a consistent interface for different AI assistants
- Allow for better context management and tool selection

This protocol is particularly powerful for monorepo development because it allows AI assistants to understand not just individual files, but the entire workspace structure, project relationships, and available tools. When combined with Nx's rich metadata about your monorepo, it creates an incredibly powerful development experience.

The advantage of MCP is that it can become a standard. In fact, more and more libraries provide implementations (e.g. [Spring AI's MCP integration](https://docs.spring.io/spring-ai/reference/api/mcp/mcp-overview.html)).

We're leveraging this by exposing such an MCP from our Nx Language server that comes with Nx Console so Cursor and other MCP compatible clients can automatically hook into the data Nx has about your workspace.

## How to enable it in your Cursor IDE

Getting started with Nx's MCP integration in Cursor is straightforward. Here's what you need to do:

**Install Nx Console** in your Cursor IDE by following our [editor setup guide](/getting-started/editor-setup).

Once installed, Cursor will automatically detect Nx Console and prompt you to configure the MCP server. You'll see a notification like this:

![cursor-nx-notification.avif](/blog/images/articles/cursor-nx-notification.avif)

**Click on the notification** to open Cursor's settings. The Nx Console notification conveniently provides a direct link to the MCP settings:

![cursor-nx-enable-mcp.avif](/blog/images/articles/cursor-nx-enable-mcp.avif)

In the settings, you'll see the Nx Console MCP server listed as "Disabled". **Click on it to enable it**:

![Cursor MCP settings screen showing the disabled Nx Console MCP server](/blog/images/articles/mcp-cursor-disabled.avif)

Once enabled, you'll see the server status change:

![Cursor MCP setting screen showing the enabled Nx MCP server](/blog/images/articles/cursor-mcp-server-config.avif)

If this is your first MCP installation, you'll notice a new `.cursor/mcp.json` file in your workspace. This file contains your MCP configuration:

![Cursor MCP configuration](/blog/images/articles/cursor-nx-mcp-configuration.avif)

Share this configuration with your team to ensure consistent settings or add it to `.gitignore` if you prefer to keep your local configuration private.

That's it! Your Cursor IDE is now configured to use Nx's MCP integration. For more details about the available features and capabilities, check out our [AI enhancement documentation](/features/enhance-AI).

{% callout type="note" title="Manual Setup" %}
If you've missed the notification, you can always run the `nx.configureMcpServer` command via the command prompt (`Ctrl/Cmd` + `Shift` + `P`) and install the MCP server that way.
{% /callout %}

## How it works

The Nx MCP integration is built on top of the official [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk). When you enable the integration, we automatically spin up a local MCP server that communicates with Cursor using Server-Sent Events (SSE). This server runs on a random available port on your localhost, ensuring it doesn't conflict with other services.

![Cursor MCP Architecture Diagram](/blog/images/articles/mcp-nx-architecture.avif)

The MCP server is configured through the `.cursor/mcp.json` file, which is automatically created in your workspace as mentioned in the previous section. Nx Console will automatically read the port specified there and spin up a matching MCP server.
You can always view and modify the configuration through `Cursor Settings -> MCP`.

### Available Tools

While the Model Context Protocol defines various functionalities (tools, resources, roots, and sampling), support in popular clients like Cursor or Claude Desktop is limited. For now, we've focused on providing a set of essential tools that leverage Nx's rich metadata:

- `nx_workspace`: Provides an annotated representation of your Nx configuration and project graph
- `nx_project_details`: Returns comprehensive configuration for any specific Nx project
- `nx_docs`: Retrieves relevant documentation sections based on your queries
- `nx_generators`: Lists all available code generators in your workspace
- `nx_generator_schema`: Provides detailed schema information for specific generators
- `nx_visualize_graph`: Opens interactive project or task graph visualizations directly in your IDE

### Data Flow

Behind the scenes, we use the Nx Language Server (`nxls`) that comes as part of the [Nx Console extension](/getting-started/editor-setup) to gather workspace information. Each tool request triggers a specific data flow:

1. The tool receives your query
2. `nxls` retrieves relevant workspace information from your Nx workspace
3. We transform this data into a format optimized for LLM consumption
4. The transformed data is enriched with natural language descriptions
5. The result is passed back to the AI assistant

For example, when handling project graph queries, we transform the raw graph data into a more structured format that includes explanations about project relationships and dependencies. You can see this transformation in action in our [project graph transformation code](https://github.com/nrwl/nx-console/blob/9a0425d8c0ae74d326bdd030e8793f2c4d0161e9/libs/shared/llm-context/src/lib/project-graph.ts#L5).

### IDE Integration

The MCP's true potential lies in its deep integration with your IDE. Right now, it can trigger these actions directly in your IDE:

- Visualize the project graph focused on a specific project
- Visualize the task graph for a specific project and target

This is just the beginning. We plan to expand these capabilities in future releases and would love to hear your feedback and ideas on what you'd like to see.

### Using MCP Outside Cursor

If you want to use our MCP integration with other tools that support the protocol (like Claude Desktop, Cline, Windsurf and more), you can run it in `stdio` mode. This allows direct communication between the client and server process. Follow the instructions in the [nx-mcp npm package documentation](https://www.npmjs.com/package/nx-mcp?activeTab=readme) to set this up.

## Let's see it in action

The [Youtube video]() above showcases the below example queries, showing how Cursor leverages the different exposed Nx MCP tools to get more information to correctly take action.

- If I change the public API of feat-product-detail, which other projects might be affected by that change?
- Use Nx to generate a new React library for handling past orders.
- Can you configure Nx release for the packages of this workspace? Just update nx.json with the necessary configuration. Use conventional commits as the versioning strategy. Also feel free to use the Nx docs to pull more info on how to configure it.

## Wrapping up

This is just our very first version of developing an MCP server. The protocol is evolving as we speak and getting more powerful by implementing new possibilities for enriching your LLM queries with more contextual data.

But already these first interactions show how much more helpful and precise the answers become, making Cursor specifically a lot more useful.

We **want your feedback though!** Reach out on our socials ([Twitter/X](https://x.com/NxDevTools), [Bluesky](https://bsky.app/profile/nx.dev) and [LinkedIn](https://www.linkedin.com/company/nrwl/)) or hop into our [weekly office hours on Discord](http://go.nx.dev/office-hours).

Stay tuned for more updates on this MCP integration as well as enhancements on the [VSCode Copilot front](/blog/nx-just-made-your-llm-smarter).

---

Learn more:

- 🧠 [Nx AI Docs](/features/enhance-AI)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
