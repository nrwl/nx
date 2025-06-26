---
title: 'Your AI Assistant Can Now Read Your Terminal: Real-Time Development Error Fixing'
slug: nx-terminal-integration-ai
authors: ['Juri Strumpflohner']
tags: ['nx', 'nx-console', 'ai', 'terminal']
cover_image: /blog/images/articles/bg-nx-tui-llm-integration.avif
description: 'Learn how Nx Console now enables AI assistants to read your terminal output in real-time, automatically detecting and fixing development errors as they happen.'
youtubeUrl: https://youtu.be/Cbc9_W5J6DA
pinned: false
---

{% callout type="deepdive" title="Series: Making your LLM smarter" expanded=true %}

- [Nx Just Made Your LLM Way Smarter](/blog/nx-just-made-your-llm-smarter)
- [Making Cursor Smarter with an MCP Server For Nx Monorepos](/blog/nx-made-cursor-smarter)
- [Nx MCP Now Available for VS Code Copilot](/blog/nx-mcp-vscode-copilot)
- [Nx and AI: Why They Work so Well Together](/blog/nx-and-ai-why-they-work-together)
- [Save Time: Connecting Your Editor, CI and LLMs](/blog/nx-editor-ci-llm-integration)
- [Enhancing Nx Generators with AI: Predictability Meets Intelligence](/blog/nx-generators-ai-integration)
- **Your AI Assistant Can Now Read Your Terminal: Real-Time Development Error Fixing**
- [Introducing Self-Healing CI for Nx and Nx Cloud](/blog/nx-self-healing-ci)
- [Analyze Your Nx Cloud Runs With Your AI Assistant](/blog/nx-cloud-analyze-via-nx-mcp)
- [Automatically Fix your CI Failures with JetBrains AI Assistant](/blog/jetbrains-ci-autofix)

{% /callout %}

One of the most frustrating aspects of working with AI coding assistants has been **their inability to see what's happening in your terminal**. When your development server crashes with an error, you'd have to manually copy the error message, paste it into your chat, and explain the context.

**Not anymore.** We've just shipped an integration that allows your AI assistant to access your [Nx terminal](/blog/nx-21-terminal-ui), the tasks that are currently running as well as their output. This opens up a whole new interaction workflow where you don't have to provide context: the LLM "would just know" about it. Let's dive in.

{% toc /%}

## Let's backtrack for a second - what's this actually about?

Besides helping you write new code, LLMs are also great at helping you debug issues. Stacktraces are ideal for that because they provide a lot of information. To involve your AI assistant, you'd usually copy & paste the stacktrace to your chat window, or use the "Add to Chat" functionalities of editors.

![](/blog/images/articles/llm-add-to-chat.avif)

While this works perfectly, **we figured we can do better**. We want to open up the workflow so that the LLM can independently - even as part of a separate interaction - just grab the necessary context from the terminal to satisfy a user request with more precision.

To demo that, I can just ask `What's currently running in my terminal` or even more concretely `Help me fix my broken dev server`:

![](/blog/images/articles/nx-tui-llm-fix-my-broken-code.avif)

As a side note, for convenience, we also added a shortcut directly to our Nx terminal UI that allows you to send the output to a new LLM chat conversation.

![](/blog/images/articles/nx-tui-send-to-llm.avif)

## Technical architecture: How does this actually work?

![](/blog/images/articles/nx-llm-terminal-integration.avif)

This integration leverages several components working together:

- **Nx Console as the MCP Host**: [Nx Console](/getting-started/editor-setup) acts as the Model Context Protocol (MCP) host, providing the communication bridge between your AI assistant and the Nx ecosystem.

- **JSON RPC Communication**: When you launch the new Nx terminal UI, Nx Console establishes a JSON RPC server that creates a communication channel between the terminal running your tasks, the Nx Console instance in your editor, and your AI assistant through the MCP.

- **Nx Terminal UI**: The new [Nx Terminal UI](/blog/nx-21-terminal-ui) connects to this RPC server to send updates on the current tasks that are run, their state and output.

When the LLM assistant requires knowledge about the tasks or terminal output, it communicates via the Nx MCP hosted by Nx Console, which in turn returns the relevant data.

Some things to point out here:

- **This also works if you run the Nx TUI in another terminal, like Warp.** It doesn't have to run within VSCode or Cursor. As long as Nx Console runs in one of the editors (for this workspace), the Nx TUI would be able to connect to it.
- All of this is also **made in a way that it is "workspace-aware"**, ensuring that the terminal communication is tied to the correct workspace instance, so you don't get confused data if you have multiple Nx workspaces running simultaneously.

## Why this integration is powerful

This terminal integration gives your AI assistant **complete visibility into the three critical areas of your development workflow**:

- **Source Code**: Your LLM already has access to your codebase, which gets significantly enhanced by the [Nx MCP's higher-level structural understanding](/blog/nx-mcp-vscode-copilot) of workspace architecture, project relationships, and monorepo organization.

- **Browser Environment**: For web applications, you can combine this with browser monitoring tools like [Playwright MCP or BrowserTools MCP](https://github.com/AgentDeskAI/browser-tools-mcp) to give your AI assistant access to console logs, network requests, and browser dev tools data.

- **Terminal Output**: And now, with this new feature, your AI assistant has direct access to terminal processes, build outputs, error logs, and running tasks.

**But this isn't just about convenience** (though never having to copy-paste stack traces again is pretty amazing). The real power lies in **autonomous context retrieval**: your LLM can now independently call into terminal processes and output logs whenever it determines this information might be useful to satisfy your request, without you explicitly saying "fix my terminal" or "look at the terminal."

## Getting started

To use this feature, you'll need:

1. **[Nx Console](/getting-started/editor-setup)** installed in your editor
2. **The [Nx MCP server configured](/features/enhance-AI)** for your AI assistant
3. **The new Nx terminal UI** (available in the latest version of Nx)

Once set up, simply run your development tasks through Nx and start asking your AI assistant for help when issues arise.

## Looking forward

This terminal integration represents another crucial step in our core mission at Nx: **improving developer experience and making LLMs truly usable for large-scale workspaces**. The key to achieving this lies in providing LLMs with comprehensive context, enabling them to make better-informed decisions rather than operating in isolation.

Large monorepos present unique challenges that generic AI assistants simply can't handle effectively without deep contextual understanding. By systematically exposing different layers of your development environment to LLMs, we're building a complete picture that enables truly intelligent assistance:

- **Workspace Structure Context**: Through our [MCP integration](/blog/nx-mcp-vscode-copilot), LLMs gain architectural awareness of your monorepo - understanding project relationships, dependencies, and organizational patterns that are crucial for making informed development decisions.

- **CI Pipeline Context**: Our [CI integration](/blog/nx-editor-ci-llm-integration) provides LLMs with real-time visibility into build failures, test results, and deployment status, enabling proactive problem-solving before issues compound.

- **Terminal Context**: And now, with this terminal integration, LLMs have access to local development processes, build outputs, and runtime errors - completing the picture of your development environment.

This isn't just about convenience (though never having to copy-paste stack traces is pretty amazing). **It's about fundamentally changing how AI assistants understand and interact with complex development workflows.** When an LLM has visibility into your workspace architecture, your CI pipeline status, and your local terminal output, it can provide contextually relevant assistance that actually scales with your codebase complexity.

We're already working on even more "agentic" features that will further enhance this integrated experience, **making your AI assistant a reliable peer programmer** that actually provides value.

---

Learn more:

- 🧠 [Nx AI Docs](/features/enhance-AI)
- 🛠️ [Nx Terminal UI](/blog/nx-21-terminal-ui)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 👩‍💻 [Nx Console GitHub](https://github.com/nrwl/nx-console)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
