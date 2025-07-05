---
title: 'Save Time: Connecting Your Editor, CI and LLMs'
slug: nx-editor-ci-llm-integration
authors: ['Juri Strumpflohner']
tags: ['nx', 'nx-console', 'ai', 'ci']
cover_image: /blog/images/articles/bg-nx-mcp-cloud-integration.jpg
description: 'Learn how Nx Console integrates with CI to alert you of failing builds and uses the Nx MCP to automatically fix errors right from your editor.'
youtubeUrl: https://youtu.be/fPqPh4h8RJg
---

{% callout type="deepdive" title="Series: Making your LLM smarter" expanded=true %}

- [Nx Just Made Your LLM Way Smarter](/blog/nx-just-made-your-llm-smarter)
- [Making Cursor Smarter with an MCP Server For Nx Monorepos](/blog/nx-made-cursor-smarter)
- [Nx MCP Now Available for VS Code Copilot](/blog/nx-mcp-vscode-copilot)
- [Nx and AI: Why They Work so Well Together](/blog/nx-and-ai-why-they-work-together)
- **Save Time: Connecting Your Editor, CI and LLMs**
- [Enhancing Nx Generators with AI: Predictability Meets Intelligence](/blog/nx-generators-ai-integration)
- [Your AI Assistant Can Now Read Your Terminal: Real-Time Development Error Fixing](/blog/nx-terminal-integration-ai)
- [Introducing Self-Healing CI for Nx and Nx Cloud](/blog/nx-self-healing-ci)
- [Analyze Your Nx Cloud Runs With Your AI Assistant](/blog/nx-cloud-analyze-via-nx-mcp)
- [Automatically Fix your CI Failures with JetBrains AI Assistant](/blog/jetbrains-ci-autofix)

{% /callout %}

We've been continuously improving how Nx integrates with AI assistants to make your development experience more productive. In our [previous posts](/blog/nx-just-made-your-llm-smarter), we've shown how Nx makes your LLM smarter by providing rich metadata about your monorepo structure. We've also discussed our [MCP server implementations](/blog/nx-made-cursor-smarter) for both [Cursor](/blog/nx-made-cursor-smarter) and [VS Code Copilot](/blog/nx-mcp-vscode-copilot).

Today, we're taking this integration to the next level by connecting your CI pipeline directly to your AI assistant, creating a fully integrated workflow that helps you **detect and fix** failing builds faster than ever before.

{% toc /%}

## The Full Circle: From Editor to CI and Back

When you work in a large codebase, you often follow this workflow:

1. You make changes to your code in your editor
2. You commit and push those changes to GitHub
3. A CI run is triggered to validate your changes
4. You continue working on something else while CI runs
5. Eventually, you check back to see if your CI passed
6. If it failed, you have to understand why and fix it
7. Push again and wait for another CI run

This process introduces significant delays in your workflow. The **biggest waste of time happens between steps 4 and 5**. While your CI is running, you've already context-switched to another task. Your CI might fail after just a few minutes, but you won't know until you manually check back - which could be 30 minutes, an hour, or even after lunch. All that time is wasted when you could have fixed the issue immediately and triggered a new CI run.

**What if your editor could notify you as soon as a CI failure happens and help you fix it immediately?**

That's exactly what our new integration does. By connecting [Nx Console](/getting-started/editor-setup), [Nx Cloud](/nx-cloud), and our [MCP server](/features/enhance-AI), we've created a workflow that:

1. Notifies you in your editor when your CI build fails
2. Provides a one-click option to have an AI assistant help you fix the issue
3. Automatically applies the fix to your local workspace
4. Lets you review and push the changes to update your PR

## How It Works

![Integration between Nx Console, Nx Cloud and the Nx MCP](/blog/images/articles/nx-mcp-ci-architecture.avif)

This integration leverages multiple components of the Nx ecosystem:

- **Nx Console Extension**: Our editor extension (available for [VS Code, Cursor, and IntelliJ](/getting-started/editor-setup)) monitors your CI runs through Nx Cloud. We [wrote about this previously](/blog/nx-cloud-pipelines-come-to-nx-console).

- **Nx Cloud**: Our CI acceleration service not only makes your builds faster but also maintains detailed information about each task, including failures, logs, and affected projects.

- **MCP Server**: The Model Context Protocol server we've implemented provides a structured interface for AI assistants to interact with your codebase and Nx tools.

- **AI Assistant**: Whether you're using GitHub Copilot, Claude, or another AI assistant that supports MCP, it can leverage all this context to understand and fix CI errors.

When a CI build fails, the Nx Console extension receives a notification from Nx Cloud. It then displays an alert in your editor with options to view the logs or have AI help fix the issue.

![Nx Console shows the notification of the CI failure](/blog/images/articles/ci-notification.avif)

If you choose AI assistance, the MCP server:

1. Retrieves detailed information about the failed CI run from Nx Cloud
2. Provides this context to your AI assistant
3. Allows the assistant to analyze your git history to understand what changed in your PR
4. Helps the assistant navigate your codebase to identify and fix the issue

## The Power of AI + Context: Why This Integration Works

The key advantage of this integration is the rich contextual data provided to the AI assistant:

- **MCP Server with Local Nx Data**: Nx deeply understands your workspace structure - how projects relate to each other, which tasks run where, and your project's dependencies. Our MCP server exposes this knowledge to the LLM, providing the context it needs to navigate your codebase intelligently.

- **Nx Cloud CI Information**: The MCP server also receives detailed CI failure data from Nx Cloud - exact error logs, which tasks failed, and under what conditions. This eliminates guesswork about what went wrong.

- **Editor Integration**: All this happens directly in your editor where you're already working. The AI has access to your current code state and can directly apply fixes to your local workspace without context switching.

This powerful combination means the AI assistant isn't just making generic suggestions - it's providing targeted fixes based on comprehensive understanding of both your codebase structure and the specific CI failure.

## Why This Matters: Optimizing Time to Meaningful Feedback

This integration dramatically improves development velocity in several ways:

1. **Reduced Context Switching**: You don't need to leave your editor to understand and fix CI failures, eliminating the cognitive overhead of switching between tools.

2. **Eliminating Wasted Wait Time**: Instead of moving on to another task while waiting for CI and potentially wasting 30+ minutes before discovering a failure, you're notified immediately when issues occur.

3. **Faster Feedback Loops**: Fix problems while the context is still fresh in your mind and submit updated PRs quickly, dramatically shortening the time from commit to merge.

4. **Increased Development Velocity**: By reducing the cycle time of each PR iteration, you can merge more changes to your main branch every day, accelerating your team's overall productivity.

As [Victor Savkin mentioned in his recent post](/blog/nx-and-ai-why-they-work-together), this is part of our broader vision for integrated development tools working seamlessly with AI systems:

> "Coding assistants get notified about CI execution results while the CI is still running. The assistant gets relevant logs and files and is able to explain or fix the CI error and push changes before the CI execution even completes."

## How to Get Started

To use this feature, you'll need:

1. [Nx Console](/getting-started/editor-setup) installed in your editor (VS Code, Cursor, or IntelliJ)
2. An [Nx Cloud](/nx-cloud) account for your CI runs (there's a Hobby plan as well)
3. The MCP server configured for your editor (see our guides [in the docs](/features/enhance-AI))

Once these components are in place, your editor will automatically notify you of CI failures with the option to get AI help.

---

Learn more:

- 🧠 [Nx AI Docs](/features/enhance-AI)
- 🌩️ [Nx Cloud](/nx-cloud)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 👩‍💻 [Nx Console GitHub](https://github.com/nrwl/nx-console)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
