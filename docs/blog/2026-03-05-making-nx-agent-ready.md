---
title: 'Agentic Experience Is the New Developer Experience'
slug: 'making-nx-agent-ready'
authors: ['Max Kless', 'Juri Strumpflohner']
tags: [nx, ai, cli]
cover_image: /blog/images/articles/bg-making-nx-agent-ready.avif
description: 'How we redesigned Nx CLI commands like nx import, nx init, and create-nx-workspace to work seamlessly with AI agents, and the AX principles behind the changes.'
---

There's been a growing realization in the ecosystem that [**agentic experience (AX)** is becoming just as important as traditional developer experience.](https://biilmann.blog/articles/introducing-ax/) The tools we build aren't just used by humans typing in a terminal anymore. They're increasingly called by AI agents acting on behalf of developers. This requires a mental shift on our side as tool builders. If AI agents struggle to access, understand and interact with our software, we risk being left behind in this time of rapid transformation.

Instead of adding friction to developers and agents working with Nx, we're focused on expanding the scope at which agents can act autonomously: in your terminal, repository and beyond. We just shipped a major round of improvements to Nx's CLI commands (`create-nx-workspace`, `nx init`, `nx import`), all specifically designed to make them work well with AI agents. We wanted to use the opportunity to share how we think about AX and the principles behind the changes.

And what plays nicely into our hands: Agents love CLIs and Nx already has a pretty powerful one!

{% tweet url="https://x.com/victorsavkin/status/2014024244015874327" /%}

## Why AX Matters Now

Agents are getting more autonomous every month. Writing code is [no longer the constraint](/blog/ai-agents-and-continuity). The bottleneck has shifted to everything around code authoring: coordination, CI feedback loops, onboarding to new tools and services. Every friction point that forces a human back into the loop breaks the continuous agent session that makes these workflows productive.

We've written about this shift before. In [Autonomous Agents at Scale](/blog/ai-agents-and-continuity), we argued that the organizations that win will be the ones where more work can be delegated to agents running uninterrupted. In [End to End Autonomous AI Agent Workflows](/blog/autonomous-ai-workflows-with-nx), we showed what that looks like in practice with Nx.

The infrastructure matters. How your codebase is organized, the quality of context the agent has access to, and whether guardrails and feedback loops are in place. These factors determine whether agents become a real productivity multiplier or just another tool that needs constant babysitting. AX is how we think about closing that gap.

## Optimizing for AX

Over the last weeks and months, we've spent a lot of time reading through agent logs and retracing what they did while solving a given problem. It's a very useful exercise. After working on a project for a while, it's easy to forget how much implicit context about a problem space exists in your head. Watching where an agent has to work harder to fill these gaps will show you where more attention is needed.

The wonderful thing is, improvements to AX tend to also improve DX. If you manage to explain a concept better or make a CLI command more intuitive, humans will benefit just as much as agents.

When we looked at where agents struggled most with Nx's CLI, a few challenges kept coming up: agents lacked the right context to make good decisions, they couldn't parse interactive output, they failed when retrying commands, and overly prescriptive output led them down the wrong path. The sections below dig into each of these and what we did about them.

### Context, Context, Context

What's in an agent's context window has a major impact on the quality of the results it will produce. As the context fills up, model intelligence deteriorates ([context rot](https://research.trychroma.com/context-rot)). So instead of endless exploration and trial-and-error, we want to provide agents with the knowledge they need to complete their tasks:

- **Skills** are a great way of giving domain-specific smarts to agents and have emerged as a clear standard. Read more in our blog post '[Why we deleted (most of) our MCP tools](/blog/why-we-deleted-most-of-our-mcp-tools)'
- Just like a human would, agents can call **`--help`** to understand more about a CLI command. We need to keep making sure that the results are up-to-date and progressively disclose relevant information on subcommands
- **Documentation** is becoming even more important in 2026. Whenever an agent shows a gap in understanding, we want to make sure there's a doc we can point them at in the future.

Agents are capable of figuring things out on the fly. But every time they have to backtrack, retry, and re-learn because a CLI command was misleading or its output was ambiguous, that's wasted tokens and wasted time. The goal is to get the right context in front of the agent on the first try, not on the third.

### Clear, Structured Feedback

A surprising shortcoming of agents currently is their inability to deal with dynamic prompts and interactive TUIs. Text goes into a model and text comes out so it's important that we play into the models' strengths instead of fighting it every step of the way.

Commands like `nx import` and `nx init` relied heavily on terminal prompts. Now, when we detect they are being called from inside an AI agent, our commands emit **JSON-formatted messages** for key events: progress updates, required inputs, errors, and completion with suggested next steps. This gives agents structured data they can easily parse and act on.

``` {% command="npx nx import --sourceRepository=../monorepo-1" %}
{"stage":"starting","message":"Importing repository..."}
{
  "stage":            "needs_input",
  "success":          false,
  "inputType":        "import_options",
  "message":          "Required options missing. Re-invoke with the listed flags.",
  "missingFields":    ["ref", "destination"],
  "availableOptions": {
    "sourceRepository": {
      "description":  "URL or path of the repository to import.",
      "flag":         "--sourceRepository",
      "required":     true
    },
    "ref": {
      "description":  "Branch to import from the source repository.",
      "flag":         "--ref",
      "required":     true
    },
    "source": {
      "description":  "Directory within the source repo to import (blank = entire repo).",
      "flag":         "--source",
      "required":     false
    },
    "destination": {
      "description":  "Target directory in this workspace to import into.",
      "flag":         "--destination",
      "required":     true
    }
  },
  "exampleCommand":   "nx import ../monorepo-1 --ref=main --source=apps/my-app --destination=apps/my-app"
}
```

### Idempotency

If an agent runs a command and gets asked for input halfway through, it needs to be able to **call the command again** with the right inputs without redoing all the previous work or erroring out. This is idempotency, and it's critical for agents that operate in a loop of "try, learn, retry."

We made sure that commands like `nx import` can handle being re-invoked with tweaked inputs gracefully.

### Informative > Instructive

This one is subtle but important. When a command outputs information, it should **provide structure and context** rather than try to force the model into a specific behavior. The output should be informative, not instructive.

In the past, we've experimented with creating more cleanly-defined flows for agents to follow, but this often ends up frustrating due to the non-determinism of these systems as well as our inherently limited knowledge about the exact problem a developer is trying to solve.

### Should Tools Behave Differently for Agents?

Not everyone agrees with this approach. There's a [reasonable concern](https://github.com/nrwl/nx/pull/33766#discussion_r2614578920) that if tools start behaving differently based on who's calling them, agents might never learn to handle the "real" output, and you end up maintaining two code paths indefinitely.

An interesting perspective from the other end of the spectrum comes from Justin Poehnelt at Google, who [built a CLI for Google Workspace](https://justin.poehnelt.com/posts/rewrite-your-cli-for-ai-agents/) that was designed agent-first from the start. Since the CLI didn't exist before and agents are the primary audience, the design choices look very different: raw JSON payloads as input instead of flags, runtime schema introspection so agents never need external docs, and aggressive input hardening against hallucinations. When you know agents are the target user, patterns like these make a lot of sense and provide further insight into what optimizing for AX can look like.

The reality is that this is still early and nobody has all the answers. Our approach sits somewhere in the middle: we detect the agent context and adapt the output format, but we're not rebuilding the CLI surface from scratch. Agents get structured JSON feedback while humans keep the interactive experience they're used to. Whether these paths converge or diverge further is something we'll figure out as the ecosystem matures.

## Looking Ahead: Agentic Onboarding

Everything we've covered so far is about optimizing individual CLI commands for agents. But there's a bigger picture: **agentic onboarding**. Agents should be able to autonomously (or with minimal human involvement) onboard to SaaS services, connect workspaces, and configure infrastructure.

This is what we're actively working on. Imagine an agent that takes your existing Nx workspace, connects it to Nx Cloud, configures CI pipelines, tunes task distribution for your specific project graph, and gets everything optimized for an efficient CI setup. All without a human clicking through a dashboard or copy-pasting tokens.

The principles we applied to `nx import` are being rolled out across the Nx CLI, and agentic onboarding via `nx connect` is next. The line between developer tools and agent tools is blurring fast, and we think that's a good thing. We're building for both.

We'd love to hear your thoughts! Let us know via [GitHub](https://github.com/nrwl/nx) or reach out on social media if you have ideas or feedback.

## Further Reading

- [agent-experience.dev](https://agent-experience.dev) by the Cloudflare AX team: 26 patterns for agent-friendly systems, organized around toolability, recoverability, and traceability
- [agentexperience.ax](https://agentexperience.ax) by Netlify: collaborative AX principles covering agent accessibility, contextual alignment, and transparent identity
- [Agentic Engineering Patterns](https://simonwillison.net/guides/agentic-engineering-patterns/) by Simon Willison: practical coding patterns for working with agents, including TDD workflows and managing cognitive debt
- [You Need to Rewrite Your CLI for AI Agents](https://justin.poehnelt.com/posts/rewrite-your-cli-for-ai-agents/) by Justin Poehnelt (Google): agent-first CLI design with concrete patterns like JSON payloads, schema introspection, input hardening, and dry-run safety rails
