---
title: 'Why we deleted (most of) our MCP tools'
slug: 'why-we-deleted-most-of-our-mcp-tools'
authors: ['Max Kless']
tags: [nx, ai, mcp]
cover_image: /blog/images/articles/bg-autonomous-agents-at-scale.avif
description: 'How the shift from MCP tools to agent skills changed the way AI assistants work with Nx monorepos — and why MCP still matters.'
---

Remember when MCP was the hot new thing? That was barely a year ago. We built [MCP tools for Nx](/blog/nx-made-cursor-smarter) — surfacing project graphs, generator schemas, task pipelines directly into LLM conversations — and for the first time AI assistants could actually _understand_ your workspace. We shipped integrations for Cursor, VS Code Copilot, and JetBrains, and it worked well.

MCPs still have their place. But for a lot of what they were doing, better solutions exist now.

## Are MCPs Obsolete?

No. But let me backtrack a little and explain why we deleted most of ours.

When Claude Code launched, it changed the default interaction model. Of course, many agents have been around and the landscape is always evolving. But because it's such a cornerstone of public perception and my personal tool of choice, I'll keep using it as an example here. Instead of asking questions and getting answers, developers now run fully agentic sessions — AI executing commands in the terminal, iterating on code, working autonomously for entire tasks. The whole industry moved from "ask and answer" to "plan and execute."

This had a subtle but important consequence for MCP: the "just give LLMs extra context" approach was becoming outdated. When an agent can run `nx show project myapp` in the terminal and read the output itself, why would it need an MCP tool to do the same thing?

By late 2025, the sentiment on MCP started to turn. Developers were recognizing the token cost of "dumb" MCP tools — tools that dump large JSON payloads into context whether or not the agent needs all of it. Even Anthropic, the original creators of MCP, published about [code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp), showing a 98.7% token reduction by having agents process MCP results programmatically instead of dumping raw payloads into context.

But for many cases, even this is overengineered. Modern agents can use the Nx CLI just as humans do and are perfectly capable of piping together tools like `jq` to extract exactly the information they need. This saves tokens because not every aspect of the project graph or a generator schema has to be loaded into context.

The key insight: **agents build their own context**.

## Enter Skills

So if agents can already use the CLI, what's left to improve? The answer is **domain-specific knowledge**. An agent might be able to run `nx generate` just fine, but does it know _when_ to use a generator? Does it know your workspace conventions? Does it know to verify its work before returning to you?

This is where **skills and subagents** come in. Instead of giving agents tools that return data, we give them clear instructions for _how to work with Nx_. Think of it as the difference between handing someone a wrench and teaching them how to be a mechanic. Skills are also more token-efficient than MCP tools: they're incrementally loaded only when the agent decides it needs them, rather than occupying tool slots upfront. (That said, this is both a pro and a con — the agent has to recognize when a skill is relevant.) If you want a good introduction to skills as a concept, check out ["Don't Build Agents, Build Skills Instead"](https://www.youtube.com/watch?v=CEvIs9y1uog) by Barry Zhang & Mahesh Murag from Anthropic.

We've been building and shipping skills as part of the [Nx AI Agent Skills](/blog/nx-ai-agent-skills) plugin, and the results have been really encouraging. Let's break down a few of the key ones:

- **Generator skills** -- These teach agents how and when to use Nx generators, follow workspace conventions, and scaffold code consistently. Instead of just exposing the generator schema via MCP, the skill explains what generators are available, when to reach for them, and how to verify the output.
- **CI fix subagent** -- An autonomous agent that retrieves failed CI task outputs, analyzes the errors, applies fixes, and iterates until things are green. This builds on our [Self-Healing CI](/blog/nx-self-healing-ci) work and takes it further with agentic capabilities. We covered this in depth in our post on [autonomous AI agent workflows](/blog/autonomous-ai-workflows-with-nx).
- **Project graph navigation** -- Skills that teach agents how to explore your workspace's dependency graph, understand task targets, and reason about what a change affects.

### The Numbers

We ran benchmarks comparing agent performance with skills versus our previous MCP-only approach, and the results speak for themselves:

**Nx question accuracy** (various questions with clear right/wrong answers, scored by LLM):

|        | Baseline | MCP only | Skills   |
| ------ | -------- | -------- | -------- |
| Sonnet | 78%      | 85%      | **100%** |
| Haiku  | 60%      | 84%      | **94%**  |

**Generation tasks** (mixed complexity scaffolding tasks):

|                               | MCP only | Skills  |
| ----------------------------- | -------- | ------- |
| Generator usage rate (Sonnet) | 71%      | **93%** |
| Generator usage rate (Haiku)  | 71%      | **98%** |
| Verification rate (Sonnet)    | 32%      | **80%** |
| Verification rate (Haiku)     | 46%      | **64%** |

One interesting pattern: for smaller models like Haiku, the improvements are even more pronounced. With skills, Haiku nearly matches Sonnet on question accuracy -- up from just 60% at baseline. The structured guidance in skills helps compensate where smarter models would just persevere through exploration.

For simple question-answering tasks, skills reduced token consumption compared to MCP tools. For generation tasks, tokens went up -- the skills include more thorough steps to verify output and match workspace conventions. We think that's the right tradeoff, and we're actively iterating to bring the cost down further.

## Where MCP Still Shines

Even though we deleted most of our MCP tools, MCP itself remains essential. [Dynamic tool search](https://www.anthropic.com/engineering/advanced-tool-use) has reduced the impact on tokens, and there are things that are harder for agents to do on their own or to teach in a skill:

- **Authenticated APIs** - Talking to Nx Cloud, retrieving CI run data, interacting with services that require auth tokens. An agent can't just `curl` an authenticated endpoint without the right setup.
- **Communicating with running processes** -- Interacting with the IDE extension, streaming data from long-running processes, or coordinating between different tools that are already running.

These are the places where our MCP still provides major value — connecting agents to systems they can't reach on their own.

## What's Next

We're planning to keep optimizing this setup: introducing more skills and subagents, refining the ones we have, and building things into our MCP that are genuinely hard to do otherwise. The division of labor is becoming clear: **skills for knowledge, MCP for connectivity**.

We're also working on **Polygraph** — orchestrating agents across connected repositories via Nx Cloud. More on that soon.

We'd love to hear how you're using Nx with AI tools. Let us know on [GitHub](https://github.com/nrwl/nx) or [Discord](https://go.nx.dev/community)!

---

## Learn More

- [Nx AI Agent Skills](/blog/nx-ai-agent-skills)
- [Autonomous AI Agent Workflows with Nx](/blog/autonomous-ai-workflows-with-nx)
- [Self-Healing CI](/blog/nx-self-healing-ci)
- [Nx Docs](/docs/getting-started/intro)
- [X / Twitter](https://twitter.com/nxdevtools)
- [Nx Community Discord](https://go.nx.dev/community)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx YouTube Channel](https://www.youtube.com/@nxdevtools)
