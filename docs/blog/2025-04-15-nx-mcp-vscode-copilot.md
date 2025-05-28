---
title: 'Nx MCP Now Available for VS Code Copilot'
slug: nx-mcp-vscode-copilot
authors: ['Juri Strumpflohner']
tags: ['nx', 'nx-console', 'ai']
cover_image: /blog/images/articles/bg-copilot-nx-mcp.avif
description: 'Learn how to enhance VS Code Copilot with Nx MCP integration, providing rich monorepo context for smarter AI assistance.'
youtubeUrl: https://youtu.be/dRQq_B1HSLA
pinned: true
---

{% callout type="deepdive" title="Series: Making your LLM smarter" expanded=true %}

- [Nx Just Made Your LLM Way Smarter](/blog/nx-just-made-your-llm-smarter)
- [Making Cursor Smarter with an MCP Server For Nx Monorepos](/blog/nx-made-cursor-smarter)
- **Nx MCP Now Available for VS Code Copilot**
- [Nx and AI: Why They Work so Well Together](/blog/nx-and-ai-why-they-work-together)
- [Save Time: Connecting Your Editor, CI and LLMs](/blog/nx-editor-ci-llm-integration)
- [Enhancing Nx Generators with AI: Predictability Meets Intelligence](/blog/nx-generators-ai-integration)
- [Your AI Assistant Can Now Read Your Terminal: Real-Time Development Error Fixing](/blog/nx-terminal-integration-ai)

{% /callout %}

Back in [February we shipped the first version of Nx Console with AI features](/blog/nx-just-made-your-llm-smarter), directly integrating with GitHub Copilot's APIs to provide rich monorepo context. Now, VS Code has finally adopted the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction), and we've adapted our Cursor-based MCP implementation to work with all MCP clients, including Copilot. This integration makes your AI assistant even more powerful by providing rich context about your Nx workspace. Let's see how to set it up and what it can do for you.

{% toc /%}

## Setting up MCP in VS Code

Getting started with Nx's MCP integration in VS Code is straightforward:

1. **Install Nx Console** from the VS Code marketplace if you haven't already.
2. Once installed, VS Code will show a notification to "Improve Copilot agent with Nx-specific context"
3. Click "Yes" to automatically configure the Nx MCP server in your `.vscode/mcp.json` file

![VS Code showing the Nx MCP installation prompt](/blog/images/articles/copilot-mcp-install.avif)

{% callout type="note" title="Missed the notification?" %}
If you missed the notification, you can always run the `nx.configureMcpServer` command from the command palette (`Ctrl/Cmd + Shift + P`).
{% /callout %}

VS Code will automatically start the MCP server when needed during your interactions with the LLM. You can verify the installation by checking your VS Code settings, where you should see the Nx MCP server listed along with its available tools.

## Why Use Nx MCP in Your Monorepo?

While VS Code and Copilot can already gather information from your monorepo context, Nx MCP provides several advantages:

1. **Efficient Data Access**: Instead of analyzing numerous files to infer relationships, Nx MCP provides direct access to pre-computed metadata about your workspace.
2. **Rich Project Context**: Nx maintains detailed information about:
   - Project relationships and dependencies
   - Project tags and categorization
   - Available tasks and their configurations
   - Code ownership
   - And more...

This information is already maintained by Nx for optimizing your monorepo, and the Nx MCP makes it now available to your AI assistant as well. Most importantly, this enables Copilot to move beyond simple file-level understanding to gain more of an **architectural awareness of your workspace**. Instead of just seeing individual files and their contents, it now understands the broader context: how projects are connected, where integration points exist, which teams own what, and how changes might impact the broader system. This architectural awareness is particularly powerful in a monorepo setting, where understanding these relationships is crucial for making informed development decisions.

## Nx MCP in Action

Let's look at some practical examples of how Nx MCP enhances your AI assistant's capabilities:

### Understanding Project Relationships

You can ask questions about project dependencies and get accurate answers based on the actual project graph:

```typescript
// Example query:
'Use the provided Nx MCP tools to figure out which order projects
are related to the data-access-order project';
```

The AI will use the `nx_workspace` tool to analyze project relationships and can even visualize them using the `nx_visualize_graph` tool, showing both direct dependencies and upstream projects.

### Smart Code Generation

While LLMs can generate code on their own, Nx MCP provides a powerful combination of predictable code generation through Nx generators and AI-driven customization:

```typescript
// Example query:
"Create a new feature library in packages/order/feat-cancel-order.
Make it a React library and link it to the data-access-order project.
Don't use a bundler or generate components."
```

The AI will:

1. Use `nx_generators` to identify available generators
2. Execute the React library generator with precise options
3. Set up proper project tags and dependencies

### Documentation-Aware Configuration

To prevent hallucination and ensure up-to-date information, Nx MCP provides access to the current Nx documentation:

```typescript
// Example query:
'Add a task pipeline in nx.json that runs the build of all downstream projects before the dev command';
```

The AI will:

1. Query the Nx docs for task pipeline configuration
2. Update `nx.json` with the correct syntax
3. Configure the dependencies accurately

## Beyond File-Level Thinking

This integration isn't just about fancy AI features - it's about making your existing editor experience more productive by integrating AI capabilities where they actually make sense. Instead of jumping on the AI hype train, we're focusing on exposing Nx's deep understanding of your workspace directly in your editor through tools like Copilot. This enables:

- More precise and contextual suggestions
- Architecture-aware refactoring
- Better understanding of project boundaries and relationships
- Improved onboarding assistance for new team members

We're actively developing this integration and would love to hear your feedback! If you have ideas about what you'd like to see or how we can make this more useful for your workflow, reach out to us on [Twitter/X](https://x.com/NxDevTools), [Bluesky](https://bsky.app/profile/nx.dev), [LinkedIn](https://www.linkedin.com/company/nrwl/), or join our [weekly office hours on Discord](http://go.nx.dev/office-hours).

Also, subscribe to our [YouTube channel](https://www.youtube.com/@nxdevtools) for upcoming feature announcements and demonstrations.

Want to try it out? Install [Nx Console from the VS Code marketplace](/getting-started/editor-setup) and follow the MCP setup prompts to get started.

---

Learn more:

- 🧠 [Nx AI Docs](/features/enhance-AI)
- 📖 [Making Cursor Smarter with MCP](/blog/nx-made-cursor-smarter)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 👩‍💻 [Nx Console GitHub](https://github.com/nrwl/nx-console)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
