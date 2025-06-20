---
title: 'Automatically Fix your CI Failures with JetBrains AI Assistant'
slug: 'jetbrains-ci-autofix'
authors: ['Max Kless']
cover_image: '/blog/images/articles/jetbrains-mcp-autofixing.avif'
tags: [nx, jetbrains, ai, ci]
description: Get instant CI failure notifications and AI-powered fixes directly in your JetBrains IDE with Nx Console.
---

{% callout type="deepdive" title="Series: Making your LLM smarter" %}

- [Nx Just Made Your LLM Way Smarter](/blog/nx-just-made-your-llm-smarter)
- [Making Cursor Smarter with an MCP Server For Nx Monorepos](/blog/nx-made-cursor-smarter)
- [Nx MCP Now Available for VS Code Copilot](/blog/nx-mcp-vscode-copilot)
- [Nx and AI: Why They Work so Well Together](/blog/nx-and-ai-why-they-work-together)
- [Save Time: Connecting Your Editor, CI and LLMs](/blog/nx-editor-ci-llm-integration)
- [Enhancing Nx Generators with AI: Predictability Meets Intelligence](/blog/nx-generators-ai-integration)
- [Your AI Assistant Can Now Read Your Terminal: Real-Time Development Error Fixing](/blog/nx-terminal-integration-ai)
- [Introducing Self-Healing CI for Nx and Nx Cloud](/blog/nx-self-healing-ci)
- [Analyze Your Nx Cloud Runs With Your AI Assistant](/blog/nx-cloud-analyze-via-nx-mcp)
- **Automatically Fix your CI Failures with JetBrains AI Assistant**

{% /callout %}

We just shipped a JetBrains AI Assistant integration for failing CI pipelines! 🎉

The constant context switching between your IDE and browser to check CI results is now a thing of the past. Nx Console brings CI failure notifications directly into your JetBrains IDE – with one-click AI-powered fixes included.

Here's what makes this powerful: when a CI failure occurs, you can instantly open JetBrains AI Assistant with full context. The AI understands your entire workspace structure through our MCP integration, analyzes the failure, and suggests fixes you can apply immediately. This eliminates the need to decipher error logs or hunt through stack traces yourself.
Also check out [Nx Cloud's self-healing CI capabilities](/blog/nx-self-healing-ci) which are in many ways the next step up from this and coming the JetBrains soon.

## How it works

Under the hood, Nx Console periodically monitors your CI runs through Nx Cloud. When a task fails, Nx Console immediately sends a notification so you can inspect the failure. Or, with this release, let AI Assistant take care of fixing it automatically.

![Screenshot of notification](/blog/images/articles/autofix-notification.avif)

Click the "Help me fix this" action, and the AI Assistant opens with a pre-filled prompt containing all the necessary context: error messages, affected files, test outputs, and more. The MCP server provides rich metadata about your monorepo structure, enabling the AI to understand your project dependencies and suggest intelligent fixes that make sense in your specific context.

![Screenshot of AI Assistant](/blog/images/articles/autofix-ai-assistant.avif)

## Getting started

Setting up CI notifications takes just a few steps:

- Make sure you have [Nx Console for JetBrains](https://plugins.jetbrains.com/plugin/21060-nx-console) installed from the marketplace (1.43.0 or later)
- Enable the JetBrains AI Assistant plugin
- Enable the Nx MCP server – just click on the popup notification when it comes [or refer to our guide here](/getting-started/ai-integration#automatic-setup-with-nx-console)

Once configured, you'll receive notifications for any CI failures in your Nx Cloud workspace. The integration works across IntelliJ IDEA, WebStorm, and other JetBrains IDEs.

This is just the beginning for our AI-powered CI experience. Full self-healing CI integration is coming to JetBrains IDEs soon, where Nx Cloud will automatically process failed tasks and suggest fixes. [Try it out](/blog/nx-self-healing-ci) today and let us know what you think!
