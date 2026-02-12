---
title: 'Why we deleted (most of) our MCP tools'
slug: 'from-mcp-tools-to-agent-skills'
authors: ['Max Kless']
tags: [nx, ai, mcp]
cover_image: /blog/images/2026-02-12/cover-image.avif
description: 'How the shift from MCP tools to agent skills changed the way AI assistants work with Nx monorepos — and why MCP still matters.'
---

The world of AI developer tools looks _very_ different from just a year ago. Less than twelve months back, the standard interaction with an LLM was asking questions -- you'd highlight some code, ask Cursor or GitHub Copilot a question, and get an answer. The biggest challenge was getting any kind of context beyond your local files into the conversation. That's where MCP came in.

With MCP tools like `nx-workspace` and `nx-generators`, we could surface Nx's deep understanding of your monorepo - project graphs, generator schemas, task pipelines - directly into LLM conversations. For the first time, AI assistants could actually _understand_ your workspace. And it worked. We wrote about building MCP servers, shipped integrations for Cursor, VS Code Copilot, and JetBrains, and watched the ecosystem grow.

But then things started to shift.

## Claude Code and its siblings

When Claude Code launched, it quickly changed the default interaction model. Of course, many agents have been around and the landscape is always evolving. But because it's such a cornerstone of public perception and my personal tool of choice, I'll keep using it as an example here.
Instead of asking questions and getting answers, developers were running fully agentic sessions - AI executing commands in the terminal, iterating on code, running for minutes at a time. The whole industry moved from "ask and answer" to "plan and execute."

This had a subtle but important consequence for MCP: the "just give LLMs extra context" approach was becoming outdated. When an agent can run `nx show project myapp` in the terminal and read the output itself, why would it need an MCP tool to do the same thing?

By late 2025, the sentiment on MCP started to turn. Developers were recognizing the token cost of "dumb" MCP tools - tools that dump large JSON payloads into context whether or not the agent needs all of it. Approaches like ["code mode"](https://blog.cloudflare.com/code-mode/) with structured MCP outputs and programmatic MCP tooling started gaining traction, where agents write little scripts to process MCP tool results before loading them into context. Even Anthropic - the original creators of MCP - published about [code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp), showing a 98.7% token reduction by having agents process MCP results programmatically instead of dumping raw payloads into context.

But for many cases, even this is overengineered. Modern agents can use the Nx CLI just as humans do and are wizards at piping together chains of tools like `jq` to extract exactly the information they need. This saves tokens because not every aspect of the project graph or a generator schema has to be loaded into context.

The key insight: **agents build their own context**.

## Enter Skills

So if agents can already use the CLI, what's left to improve? The answer is **domain-specific knowledge**. An agent might be able to run `nx generate` just fine, but does it know _when_ to use a generator? Does it know your workspace conventions? Does it know to verify its work before returning to you?

This is where **skills and subagents** come in. Instead of giving agents tools that return data, we give them clear instructions for _how to work with Nx_. Think of it as the difference between handing someone a wrench and teaching them how to be a mechanic. If you want a good introduction to skills as a concept, check out ["Don't Build Agents, Build Skills Instead"](https://www.youtube.com/watch?v=CEvIs9y1uog) by Barry Zhang & Mahesh Murag from Anthropic.

We've been building and shipping skills as part of the **Nx Claude Plugin**, and the results have been really encouraging. Let's break down a few of the key ones:

- **Generator skills** -- These teach agents how and when to use Nx generators, follow workspace conventions, and scaffold code consistently. Instead of just exposing the generator schema via MCP, the skill explains what generators are available, when to reach for them, and how to verify the output.
- **CI fix subagent** -- An autonomous agent that retrieves failed CI task outputs, analyzes the errors, applies fixes, and iterates until things are green. This builds on our [Self-Healing CI](/blog/nx-self-healing-ci) work and takes it further with Claude Code's agentic capabilities.
- **Project graph navigation** -- Skills that teach agents how to explore your workspace's dependency graph, understand task targets, and reason about what a change affects.

### The Numbers

We ran benchmarks comparing agent performance with skills versus our previous MCP-only approach, and the results speak for themselves:

<!-- TODO: Replace with actual graphic/table -->

| Scenario                                                    | Improvement with Skills         |
| ----------------------------------------------------------- | ------------------------------- |
| Scaffolding tasks (generator usage & workspace consistency) | **[xyz]% more generator usage** |
| Verification before returning to user                       | **[xyz]% more often**           |
| Project graph / target / dependency questions               | **[xyz]% better scores**        |

<!-- END TODO -->

For scaffolding tasks where workspace consistency is important, our benchmarks show [xyz] more generator usage. With skills, agents actually run verification before returning to the user [xyz]% more often -- meaning fewer "looks good but doesn't compile" moments. For questions about the Nx project graph, targets, and dependencies -- where the MCP was also quite well-positioned -- the improvement is less dramatic but still measurable: [xyz]% better scores.

One interesting pattern: for smaller models like Haiku, the improvements are even bigger. The structured guidance in skills helps patch the gaps where smarter models would just persevere through exploration. Skills act as a great equalizer across model capabilities.

{% callout type="info" title="A caveat on tokens" %}
Right now, agents tend to use more tokens with skills than with MCP tools. We believe this is worth the tradeoff -- better results matter more than cheaper bad results -- but we're actively iterating to bring token usage down.
{% /callout %}

## MCP Isn't Dead

Even though we deleted most of our MCP tools, this doesn't mean MCP itself isn't useful. [Dynamic tool search](https://www.anthropic.com/engineering/advanced-tool-use) has reduced the impact on tokens, and there are things that are harder for agents to do on their own or to teach in a skill:

- **Authenticated APIs** - Talking to Nx Cloud, retrieving CI run data, interacting with services that require auth tokens. An agent can't just `curl` an authenticated endpoint without the right setup.
- **Communicating with running processes** -- Interacting with the IDE extension, streaming data from long-running processes, or coordinating between different tools that are already running.

These are the places where our MCP still provides major value. We've been refining this approach - if you haven't seen our [Self-Healing CI](/blog/nx-self-healing-ci) work, it's a great example of MCP doing what it does best: connecting agents to systems they can't reach on their own.

## What's Next

We're planning to keep optimizing this setup: introducing more skills and subagents, refining the ones we have, and building things into our MCP that are genuinely hard to do otherwise. The division of labor is becoming clear: **skills for knowledge, MCP for connectivity**.

And we're working on a major new capability of Nx Cloud and our MCP that we're really excited about: **Polygraph** - a way to orchestrate agents across connected repositories. More on that soon.

This is just the beginning. We'd love to hear how you're using Nx with AI tools and what kind of skills or integrations would be useful to you. Let us know on [GitHub](https://github.com/nrwl/nx) or [Discord](https://go.nx.dev/community)!
