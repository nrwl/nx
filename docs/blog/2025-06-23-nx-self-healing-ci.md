---
title: 'Introducing Self-Healing CI for Nx and Nx Cloud'
slug: nx-self-healing-ci
authors: ['Juri Strumpflohner']
tags: ['nx', 'nx-cloud', 'ai', 'ci']
cover_image: /blog/images/articles/thumb-self-healing-ci.avif
description: 'Introducing Nx Cloud Self-Healing CI: AI agents that automatically detect, analyze, and fix your CI failures so you do not have to babysit PRs.'
youtubeUrl: https://youtu.be/JW5Ki3PkRWA
pinned: true
---

{% callout type="deepdive" title="Series: Making your LLM smarter"  %}

- [Nx Just Made Your LLM Way Smarter](/blog/nx-just-made-your-llm-smarter)
- [Making Cursor Smarter with an MCP Server For Nx Monorepos](/blog/nx-made-cursor-smarter)
- [Nx MCP Now Available for VS Code Copilot](/blog/nx-mcp-vscode-copilot)
- [Nx and AI: Why They Work so Well Together](/blog/nx-and-ai-why-they-work-together)
- [Save Time: Connecting Your Editor, CI and LLMs](/blog/nx-editor-ci-llm-integration)
- [Enhancing Nx Generators with AI: Predictability Meets Intelligence](/blog/nx-generators-ai-integration)
- [Your AI Assistant Can Now Read Your Terminal: Real-Time Development Error Fixing](/blog/nx-terminal-integration-ai)
- **Introducing Self-Healing CI for Nx and Nx Cloud**
- [Analyze Your Nx Cloud Runs With Your AI Assistant](/blog/nx-cloud-analyze-via-nx-mcp)
- [Automatically Fix your CI Failures with JetBrains AI Assistant](/blog/jetbrains-ci-autofix)

{% /callout %}

At Nx, we've always focused on making CI faster in two ways: **speeding up your actual builds** with techniques like remote caching and distributed execution, and **accelerating your feedback cycles** by eliminating the delays that waste developer time. The end-goal: **optimizing time to green**.

But what if we could bring this to the next level? **What if your CI could fix itself?** You push a PR with an error, an AI agent automatically identifies the problem, implements the fix, validates it works, and pushes the solution back to your PR?

**Nx Cloud Self-Healing CI** makes this a reality.

{% toc /%}

## Here's what happens now

Picture this: It's 2 PM on a Tuesday. You've been deep in feature development for the past hour when you get a notification in VS Code:

![Notification in your editor about an AI fix](/blog/images/articles/notification-self-healing-ci.avif)

You click the notification, review the one-line import addition, and approve it. Thirty seconds later:

![Nx Console view of the automated fix that has been applied to your PR](/blog/images/articles/nx-console-self-healing-fix-applied.avif)

> ✅ **Fix applied! Your PR is now passing CI**

You never left your editor. Never analyzed error logs. Never manually debugged the issue. Just a quick review and approval, then back to your feature work.

This is Self-Healing CI in action.

## The problem: "babysitting" your PRs

Every developer knows this workflow:

1. **Push your code** and continue working on something else
2. **CI fails** with a simple error (missing import, linting issue, test assertion)
3. **You don't notice for 30+ minutes** because you're focused on other work
4. **Context switch** back to analyze the error and implement a fix
5. **Push the fix** and wait another 5-10 minutes for CI to complete
6. **Repeat** if there are more issues

This "babysitting" wastes countless hours across development teams. The critical waste happens in **step 3**: the delay between failure and awareness.

One big issue is already being handled: **[flaky tasks](/ci/features/flaky-tasks)**. When tests fail intermittently (same code, different results), the system retries them on different agents with zero human intervention.

**The missing piece:** What about **genuine failures**? Real bugs, configuration errors, and dependency issues that need actual code fixes. These can't be solved with retries—they need intelligent analysis and solutions.

**Enter Self-Healing CI.** It tackles failures that need real fixes, providing AI-powered analysis, fix generation, and validation. You stay in control with quick review and approval, while the AI handles the heavy lifting. Combined with flaky task detection, you now have a comprehensive system that handles every type of CI failure—so you can stay focused on building features instead of babysitting PRs.

## How Self-Healing CI works

Here's what happens when you push a PR with Self-Healing CI enabled:

![Self-Healing CI Workflow](/blog/images/articles/self-healing-flow.avif)

1. **You push your PR** - Nothing changes in your workflow
2. **Failure detected** - If tasks fail, instead of just reporting the failure, Nx Cloud starts an AI agent
3. **AI agent analyzes** - The agent examines the error logs, understands your codebase structure through Nx's project graph, and identifies the root cause
4. **Fix proposed** - The agent creates a fix and presents it to you via Nx Console or the integrated GitHub application (e.g. a comment on your GitHub PR)
5. **Validation runs in parallel** - Meanwhile, the agent validates the fix by re-running the originally failed tasks with the proposed changes
6. **Human review and approval** - You can approve the fix immediately if it looks good, or wait for validation to complete for extra confidence
7. **Automatic PR update** - Once you approve, the fix gets committed to your PR as a new commit by the AI agent
8. **Full CI re-run** - Your complete CI pipeline runs again with the applied fix

**You stay in control while the AI does the heavy lifting.** The AI acts like a peer programmer, handling the time-consuming work of analyzing failures, creating fixes, and validating solutions in the background while you continue working on other tasks. You remain in the loop throughout the process. The AI doesn't make changes autonomously, but rather proposes working fixes for your review and approval before they're applied to your PR.

The AI agent is successful at providing meaningful fixes because it **combines the context from Nx and Nx Cloud:**

- it has the complete failure context with the exact tasks that ran, including error logs
- thanks to the Nx graph, it has vast context about the codebase, including project structure, dependencies, configuration and runnable tasks
- combining the two, it can validate a fix by re-running the original CI checks

## Getting started with Self-Healing CI

To enable Self-Healing CI on your workspace:

### 1. Connect Nx Cloud

If you haven't already connected to Nx Cloud:

```shell
npx nx@latest connect
```

You can [start with the free Hobby plan](/pricing) and play around with the new AI features.

Once connected, enable AI features in your [Nx Cloud dashboard](https://nx.app):

1. **Organization Settings**: Enable AI features (required for all AI-powered functionality)
2. **Workspace Settings**: Find the "Self-Healing CI" section and toggle it on (available for all Nx Cloud plans)

![Nx Cloud workspace setting to enable Self-Healing CI](/blog/images/articles/self-healing-ci-setting.avif)

### 2. Configure Your CI Pipeline

If you're using Nx Agents, Self-Healing CI is automatically enabled. Here's an example GitHub Actions configuration with Nx Agents:

```yaml
name: CI

...

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      ...

      - run: npx nx-cloud start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="build"

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci
      - uses: nrwl/nx-set-shas@v4
      - run: npx nx affected -t lint test build
```

If you're not using Nx Agents yet, you can still enable Self-Healing CI by adding the `fix-ci` step to your pipeline. **Important**: This step must run at the end with `if: always()` to ensure it executes even when previous steps fail (which is exactly when you need the fix):

```yaml
name: CI

...

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      ...

      - run: npm ci

      - uses: nrwl/nx-set-shas@v4

      - run: npx nx affected -t lint test build

      - run: npx nx-cloud fix-ci
        if: always()
```

### 3. Install Nx Console

To receive notifications about self-healing activities directly in your editor and enable the full AI integration experience, you need [Nx Console](/getting-started/editor-setup) installed for VS Code, Cursor, or IntelliJ.

For the complete AI setup guide, see our [AI integration documentation](/getting-started/ai-integration).

## Wrapping up

Self-Healing CI completes Nx Cloud's comprehensive approach to eliminating CI friction. Combined with our existing flaky task detection and automatic retries, we now have a unified system that handles every type of CI failure automatically: flaky tests get retried transparently, genuine bugs get fixed intelligently. No more "babysitting" your PRs. The system handles the tedious work so you can stay focused on building features.

**Key takeaways:**

- **Eliminates wasted time**: No more 30-minute delays between CI failure and awareness, no more manual debugging of simple errors
- **Leverages Nx's deep context**: AI agents understand your workspace structure, project relationships, and build configurations through Nx's project graph
- **You stay in control**: Proposed fixes are presented for your review and approval—the AI doesn't make autonomous changes
- **Built on proven infrastructure**: Uses the same robust Nx Cloud infrastructure that powers distributed task execution
- **Part of a broader vision**: Continues our mission to optimize "time to green" and eliminate developer workflow friction

**Ready to try it?** Self-Healing CI is rolling out as an early access feature and is available to everyone right now—no special approval or signup required. If you don't have an Nx Cloud account yet, you can quickly [start with the Hobby plan](/pricing), connect your workspace with `npx nx@latest connect`, and get going immediately.

**For enterprise teams:** If you're already using Nx Cloud and want to learn more about how AI features like Self-Healing CI can enhance your existing setup, [reach out to us](/contact). We'd love to help you leverage these capabilities in your organization.

---

Learn more:

- 🧠 [Nx AI Docs](/features/enhance-AI)
- 🌩️ [Nx Cloud](/nx-cloud)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 👩‍💻 [Nx Console GitHub](https://github.com/nrwl/nx-console)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
