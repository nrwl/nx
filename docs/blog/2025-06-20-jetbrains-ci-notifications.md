---
title: 'Real-time CI Notifications Come to JetBrains IDEs'
slug: 'jetbrains-ci-notifications'
authors: ['Max Kless']
cover_image: '/blog/images/2025-06-20/jetbrains-ci-notifications.avif'
tags: [nx, jetbrains, ai, ci]
description: Get instant CI failure notifications and AI-powered fixes directly in your JetBrains IDE with Nx Console.
---

We just shipped real-time CI notifications for JetBrains IDEs! 🎉

The constant context switching between your IDE and browser to check CI results is now a thing of the past. Nx Console brings CI failure notifications directly into your JetBrains IDE – with one-click AI-powered fixes included.

Here's what makes this incredibly powerful: when a CI failure occurs, you can instantly open JetBrains AI Assistant with full context. The AI understands your entire workspace structure through our MCP integration, analyzes the failure, and suggests fixes you can apply immediately. This eliminates the need to decipher cryptic error logs or hunt through stack traces.
This feature also complements [Nx Cloud's upcoming self-healing CI capabilities](https://nx.dev/features/nx-cloud) – we're building towards a future where CI failures resolve themselves automatically.

## How it works

Under the hood, Nx Console periodically monitors your CI runs in Nx Cloud. When a task fails, Nx Console immediately sends a notification so you can inspect the failure. Or, with this release, let AI Assistant take care of fixing it automatically.

[Screenshot of notification & AI assistant]

Click the "Help me fix this" action, and the AI Assistant opens with a pre-filled prompt containing all the necessary context: error messages, affected files, test outputs, and more. The MCP server provides rich metadata about your monorepo structure, enabling the AI to understand your project dependencies and suggest intelligent fixes that make sense in your specific context.

## Getting started

Setting up CI notifications takes just a few steps:

- Install [Nx Console for JetBrains](https://plugins.jetbrains.com/plugin/21060-nx-console) from the marketplace
- Enable the JetBrains AI Assistant plugin
  TODO: SCREENSHOTS FOR THE NOTIFICATION, IT'S BASICALLY AUTOMATIC. ALSO ADVISE PPL TO USE 2025.1.2
- Set up the MCP server – our [detailed guide](https://nx.dev/blog/vibe-exploring-a-codebase) walks you through the process

Once configured, you'll receive notifications for any CI failures in your Nx Cloud workspace. The integration works seamlessly across IntelliJ IDEA, WebStorm, and other JetBrains IDEs.

This is just the beginning of our AI-powered CI journey. Full self-healing CI integration is coming to JetBrains IDEs soon, where failed builds will automatically create fix PRs. [Install Nx Console](https://plugins.jetbrains.com/plugin/21060-nx-console) today and let us know what you think!
