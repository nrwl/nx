---
title: 'Agentic Experience Is the New Developer Experience'
slug: 'making-nx-agent-ready'
authors: ['Max Kless', 'Juri Strumpflohner']
tags: [nx, ai, cli]
cover_image: /blog/images/articles/bg-making-nx-agent-ready.avif
description: 'How we redesigned Nx CLI commands like nx import, nx init, and create-nx-workspace to work seamlessly with AI agents, and the AX principles behind the changes.'
---

[**Agentic experience (AX)**](https://biilmann.blog/articles/introducing-ax/) is becoming just as important as traditional developer experience. The tools we build aren't just used by humans anymore. They're increasingly called by AI agents acting on behalf of developers, and if those agents struggle to interact with our software, we risk being left behind.

Instead of adding friction to developers and agents working with Nx, we're focused on expanding the scope at which agents can act autonomously: in your terminal, repository and beyond. We just shipped a major round of improvements to Nx's CLI commands (`create-nx-workspace`, `nx init`, `nx import`), all specifically designed to make them work well with AI agents. We wanted to use the opportunity to share how we think about AX and the principles behind the changes.

And what plays nicely into our hands: Agents love CLIs and Nx already has a pretty powerful one!

{% tweet url="https://x.com/victorsavkin/status/2014024244015874327" /%}

## Why AX Matters Now More Than Ever

Agents are getting more autonomous every month. Writing code is [no longer the constraint](/blog/ai-agents-and-continuity). The bottleneck has shifted to everything around code authoring: coordination, CI feedback loops, onboarding to new tools and services. Every friction point that forces a human back into the loop breaks the continuous agent session that makes these workflows productive.

We've written about this shift [before](/blog/ai-agents-and-continuity) and explored what it looks like [in practice](/blog/autonomous-ai-workflows-with-nx).

**The infrastructure matters.** How your codebase is organized, the quality of context the agent has access to, and whether guardrails and feedback loops are in place. These factors determine whether agents become a real productivity multiplier or just another tool that needs constant babysitting.

## Optimizing for AX

We've spent a lot of time reading through agent logs, retracing what they did while solving problems. It's a useful exercise: after working on a project for a while, you forget how much implicit context lives in your head. Watching where agents struggle shows you where to focus.

The good news is that AX improvements tend to also improve DX. A more intuitive CLI command helps humans just as much as agents.

When we looked at where agents struggled most, a few patterns kept coming up: missing context, inability to parse interactive output, failures when retrying commands, and overly prescriptive output leading them down the wrong path.

### Context, Context, Context

What's in an agent's context window has a major impact on the quality of the results it will produce. As the context fills up, model intelligence deteriorates ([context rot](https://research.trychroma.com/context-rot)). So instead of endless exploration and trial-and-error, we want to provide agents with the knowledge they need to complete their tasks:

- **Skills** are a great way of giving domain-specific smarts to agents and have emerged as a clear standard. Read more in our blog post '[Why we deleted (most of) our MCP tools](/blog/why-we-deleted-most-of-our-mcp-tools)'
- Just like a human would, agents can call **`--help`** to understand more about a CLI command. We need to keep making sure that the results are up-to-date and progressively disclose relevant information on subcommands
- **Documentation** is becoming even more important in 2026. Whenever an agent shows a gap in understanding, we want to make sure there's a doc we can point them at in the future.

Agents are really capable of figuring things out on the fly. But every time they have to backtrack, retry, and re-learn because a CLI command was misleading or its output was ambiguous, that's **wasted tokens and wasted time**. The goal is to get the right context in front of the agent on the first try, not on the third.

### Clear, Structured Feedback

A surprising shortcoming of agents currently is their inability to deal with dynamic prompts and interactive TUIs. Text goes into a model and text comes out so it's important that we play into the models' strengths instead of fighting it every step of the way.

Commands like `nx import` and `nx init` relied heavily on terminal prompts. Now, when we detect they are being called from inside an AI agent, our commands emit **JSON-formatted messages** for key events: progress updates, required inputs, errors, and completion with suggested next steps. This gives agents structured data they can easily parse and act on.

```{% command="npx nx import --sourceRepository=../monorepo-1" %}
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

Not everyone agrees with this approach. There's a [reasonable concern](https://github.com/nrwl/nx/pull/33766#discussion_r2614578920) that if tools behave differently for agents, you end up maintaining two code paths indefinitely.

An interesting counterpoint is Google's [agent-first CLI for Workspace](https://justin.poehnelt.com/posts/rewrite-your-cli-for-ai-agents/). Since the CLI was built from scratch with agents as the primary audience, they optimized for different things: raw JSON payloads as input, runtime schema introspection, and aggressive input hardening. When you know agents are the target user, patterns like these make a lot of sense and provide further insight into what optimizing for AX can look like.

Our approach sits in the middle: detect the agent context, adapt the output, but don't rebuild the CLI surface. This is still early and nobody has all the answers yet.

## Looking Ahead: Agentic Onboarding

Everything we've covered so far is about optimizing individual CLI commands for agents. But there's a bigger picture: **agentic onboarding**. Agents should be able to autonomously (or with minimal human involvement) onboard to SaaS services, connect workspaces, and configure infrastructure.

This is what we're actively working on. An AI agent will be able to take your existing Nx workspace, connect it to Nx Cloud, configure CI pipelines, and tune task distribution for your specific project graph.

The principles we applied to `nx import` are being rolled out across the Nx CLI, and agentic onboarding via `nx connect` is next. The line between developer tools and agent tools is blurring fast, and we think that's a good thing. We're building for both.

We'd love to hear your thoughts! Let us know via [GitHub](https://github.com/nrwl/nx) or reach out on social media if you have ideas or feedback.

## Further Reading

- [agent-experience.dev](https://agent-experience.dev) by the Cloudflare AX team: 26 patterns for agent-friendly systems, organized around toolability, recoverability, and traceability
- [agentexperience.ax](https://agentexperience.ax) by Netlify: collaborative AX principles covering agent accessibility, contextual alignment, and transparent identity
- [Agentic Engineering Patterns](https://simonwillison.net/guides/agentic-engineering-patterns/) by Simon Willison: practical coding patterns for working with agents, including TDD workflows and managing cognitive debt
- [You Need to Rewrite Your CLI for AI Agents](https://justin.poehnelt.com/posts/rewrite-your-cli-for-ai-agents/) by Justin Poehnelt (Google): agent-first CLI design with concrete patterns like JSON payloads, schema introspection, input hardening, and dry-run safety rails
