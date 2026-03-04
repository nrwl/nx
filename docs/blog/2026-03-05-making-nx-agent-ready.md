---
title: 'Agentic Experience Is the New Developer Experience'
slug: 'making-nx-agent-ready'
authors: ['Max Kless']
tags: [nx, ai, cli]
cover_image: /blog/images/articles/bg-making-nx-agent-ready.avif
description: 'How we redesigned Nx CLI commands like nx import, nx init, and create-nx-workspace to work seamlessly with AI agents, and the AX principles behind the changes.'
draft: true
---

We just shipped a major round of improvements to Nx's CLI commands, all specifically designed to make them work well with AI agents. Commands like `create-nx-workspace`, `nx init`, and `nx import` have all been updated, and I wanted to use the opportunity to give some insight into how we think about agentic experience (AX).

There's been a growing realization in the ecosystem that [**agentic experience (AX)** is becoming just as important as traditional developer experience.](https://biilmann.blog/articles/introducing-ax/) The tools we build aren't just used by humans typing in a terminal anymore. They're increasingly called by AI agents acting on behalf of developers. This requires a mental shift on our side as tool builders. If AI agents struggle to access, understand and interact with our software, we risk being left behind in this time of rapid transformation.

Instead of adding friction to developers and agents working with Nx, we're focused on expanding the scope at which agents can act autonomously: in your terminal, repository and beyond.

{% tweet url="https://x.com/victorsavkin/status/2014024244015874327" /%}

## Optimizing for AX

Over the last weeks and months, I've spent a lot of time reading through agent logs and retracing what they did while solving a given problem. It's a very useful exercise. After working on a project for a while, it's easy to forget how much implicit context about a problem space exists in your head. Watching where an agent has to work harder to fill these gaps will show you where more attention is needed.

The wonderful thing is, improvements to AX tend to also improve DX. If you manage to explain a concept better or make a CLI command more intuitive, humans will benefit just as much as agents.

### Context, Context, Context

What's in an agent's context window has a major impact on the quality of the results it will produce. As the context fills up, model intelligence deteriorates ([context rot](https://research.trychroma.com/context-rot)). So instead of endless exploration and trial-and-error, we want to provide agents with the knowledge they need to complete their tasks:

- **Skills** are a great way of giving domain-specific smarts to agents and have emerged as a clear standard. Read more in my last blog post '[Why we deleted (most of) our MCP tools](/blog/why-we-deleted-most-of-our-mcp-tools)'
- Just like a human would, agents can call **`--help`** to understand more about a CLI command. We need to keep making sure that the results are up-to-date and progressively disclose relevant information on subcommands
- **Documentation** is becoming even more important in 2026. Whenever an agent shows a gap in understanding, we want to make sure there's a doc we can point them at in the future.

### Clear, Structured Feedback

A surprising shortcoming of agents currently is their inability to deal with dynamic prompts and interactive TUIs. Text goes into a model and text comes out so it's important that we play into the models' strengths instead of fighting it every step of the way.

Commands like `nx import` and `nx init` relied heavily on terminal prompts. Now, when we detect they are being called from inside an AI agent, our commands emit **JSON-formatted messages** for key events: progress updates, required inputs, errors, and completion with suggested next steps. This gives agents structured data they can easily parse and act on.

```shell {% fileName="Terminal" %}
npx nx import --sourceRepository=../monorepo-1
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

### An Open Question: Will Human and Agent Experiences Diverge?

One thing we're thinking about is whether the human CLI experience and the agent CLI experience will start to diverge too much. If we keep building more and more optimizations for agents, how large will the difference between a human and an agent using Nx be? Does this impact models' understanding learned from human-focused documentation and training data? What are the maintenance implications of these multiple code paths?

None of this is easy to answer and we'll keep adapting as the landscape evolves. If you're curious, there's a [discussion with a VSCode maintainer](https://github.com/nrwl/nx/pull/33766) on our repo about their philosophy and how it conflicts with ours.

## Looking Ahead: Nx Connect Goes Agentic

This is just the beginning. The principles we applied to `nx import` are being rolled out across the Nx CLI, and we're especially excited about what's coming for **`nx connect`** and enabling agents to onboard onto Nx Cloud fully autonomously.

The line between developer tools and agent tools is blurring fast, and we think that's a good thing. The same qualities that make a tool great for agents make it great for humans too. We're building for both.

We'd love to hear your thoughts! Let us know via [GitHub](https://github.com/nrwl/nx) or reach out on social media if you have ideas or feedback.

**Learn more:**

- [Nx GitHub Repository](https://github.com/nrwl/nx)
- [Nx Documentation](https://nx.dev)
- [Nx Discord Community](https://go.nx.dev/community)
- [Nx YouTube Channel](https://www.youtube.com/@naborhood)
