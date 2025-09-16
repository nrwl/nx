---
title: 'A Practical Guide on Effective AI Use - AI as Your Peer Programmer'
slug: practical-guide-effective-ai-coding
authors: ['Victor Savkin']
tags: ['ai', 'development', 'productivity', 'best-practices']
cover_image: /blog/images/articles/bg-practical-ai-guide-part-1.avif
description: 'Learn how to effectively use AI coding assistants beyond simple prompts. Discover proven workflows, best practices, and strategies that transform AI from a novelty into a powerful development multiplier.'
pinned: false
---

> _"Tools amplify your talent. The better your skills, the better the tools serve you."_ — Andrew Hunt, The Pragmatic Programmer

_This is the first post in the series. Much of it aggregates the insights of colleagues at Nx (Juri Strumpflohner, James Henry, and others)
and other developers I frequently discuss this topic with (special thanks to Matt Briggs, who is a de-facto co-author of this post)._

**The main takeaway from this guide**: Being intentional and investing in workflows instead of just "using Cursor" or "chatting with GPT" is what separates effective AI-assisted development from impressive demos that don't translate to real productivity gains.

AI can supercharge your development process, but it's not a magic wand. It's like learning to use power tools - requiring practice to master but transformative once you do. The difference between developers who get 10-30% productivity gains and those who struggle with AI comes down to **having proper procedures and workflows** rather than shooting random prompts at their LLM.

{% toc /%}

## Setting Realistic Expectations

AI can enhance your development process significantly. It's useful for:

- Coding
- Thinking
- Content creation
- Learning

Depending on the company you work at and your position, how you use AI will be drastically different. A web developer at a startup spends much of their day coding. A VP at a financial organization may not have written code in years and would benefit more from content creation and thinking. Regardless, you'll find useful patterns here.

For software engineers, expected outcomes with proper AI implementation:

- Faster coding on real projects (10-30% in my personal experience)
- Faster content creation (30-50% in my personal experience)
- Improved code quality
- Accelerated skill acquisition

Getting there requires patience and experimentation. We're all figuring this out together as tools improve every few months. No one has mastered AI-assisted development yet. Give yourself room to build this skill - the learning curve is real but worth climbing.

However, set your expectations right. **The total output of your team won't go up by 30%, especially in large organizations.** Engineers in large organizations spend only a fraction of their time coding, creating content, and learning new skills. Smaller teams will get much more leverage out of using AI.

## Tool Categories, Agents and Some Recommendations

The AI space is awash with investment, making any list quickly outdated. Effective workflows typically combine tools from multiple categories.

### Main Tool Categories

- **AI-integrated Editors** - VSCode, Cursor, Windsurf, Roo Code, Intellij, Zed. Most developers' primary coding environment with integrated AI capabilities.
- **Terminal-based AI Agents** - Claude Code, Codex, Aider. Command-line tools for delegating coding tasks directly from terminal.
- **Dedicated Web/Desktop Applications** - Offer unrestricted model capabilities and features like research agents and web search, despite lacking codebase context.
- **Cloud-based Agents** - Devin, Copilot, Codex. Finally reaching reliability for simple task delegation on real projects.
- **Code Review Tools** - Graphite Diamond, Copilot. Provide early PR feedback and are increasingly useful.

For tasks outside specific coding work - research, planning, documentation, and general problem-solving - I rely on dedicated web/desktop applications that offer broader capabilities:

- **Claude Desktop** - Large context, web search, research capabilities, robust MCP support (some features require expensive Claude Max)
- **ChatGPT** - Image creation, web search, research capabilities (less code-proficient than competitors)
- **AI Studio (Gemini)** - Massive context window, code-optimized models, Google search integration
- **T3 Chat** - A fast web-based chat client that allows you to switch between multiple models and comes with a competitive, convenient pricing approach.
- **ChatWise** - A desktop-based chat client that uses a bring-your-own-key strategy, allowing you to integrate with all the models out there. You can provision a key via [OpenRouter](https://openrouter.ai/) or directly plug in the key.

All five are comparable - consistency matters more than choice. I personally value MCP integrations, so primarily use Claude Desktop.

**Model Control Protocols (MCPs)** are plug-and-play tools that AI can use to fulfill requests. They're remarkably quick to create and integrate with most agent-based tools and Claude desktop. MCPs are particularly valuable as they can enhance any of the above tool categories, providing specialized capabilities and integrations that extend the base functionality of AI coding assistants. This is exactly how we integrate Nx's capabilities with existing coding assistants like VS Code Copilot and Cursor - [learn more about our MCP implementation](/blog/nx-mcp-vscode-copilot).

### Agent Types

The most important type of tool you would use while coding is an Agent. Most of the AI work you do in Cursor, Windsurf or JetBrains is done via Agents. You can chat with agents to instruct it to do several things to your code base. Agents have built-in capabilities (integrating with your editor) and can be extended via MCP.

**There are two styles of agents:** interactive and non-interactive

### Interactive Agents (Quick Doers)

These are your everyday workhorses for AI-assisted coding. They're quick, cost-effective, but with some capability limitations.

**Recommended options:**

- **Cursor** (VSCode fork)
- **Windsurf** (Available as VSCode fork or JetBrains plugin)
- **Copilot** (VSCode native integration; almost as effective as Cursor/Windsurf and improving fast)

### Non-interactive Agents (Deep Thinkers)

More precise than interactive assistants but slower and pricier - like precision power tools versus hand tools. These excel at widespread codebase changes requiring sub-agents or extensive context.

**Recommended options:**

- **Claude Code** (terminal-based interface)
- **OpenAI Codex** (terminal-based interface)
- **JetBrains Junie**

They get less attention online because most streamers do work that works well with interactive agents. Any agent can put together a web page. "Deep Thinkers" can spend many minutes performing an operation which doesn't make for impressive videos, but they're very valuable when working on real complex systems.

Most of my work involves distributed systems, where interactive agents aren't particularly effective. In these systems, application behavior isn't easily derivable from source code—things operate at a higher level of abstraction.

I get significantly more leverage from tools like Claude Code (or Junie) than Cursor/Copilot, which creates more robust plans and provide real value in my domain. But even with Claude Code I use specific patterns and prompt and keep it on a short leash.

For tasks like writing new scripts or building web UIs, I find Copilot or Cursor work better.

## The Main Rule: Understanding and Quality over Speed

> Never commit code you don't understand.

While AI may write it, you are responsible for every character. Understanding your code completely is essential. Read, understand, investigate the code that AI generates.

If AI generates subpar code, improve it and learn how to get better results. The goal is AI that produces what you would have written yourself.

**Effective AI use means:**

- More thinking and reading
- Less typing

One of the greatest risks of using AI is generating large amounts of code that are poorly understood and do not integrate well with the overall system architecture. Mitigate this risk. **AI tools create space for better engineering practices - not just cramming in more features. **

**Critical thinking and deep codebase familiarity remain essential. They're the foundation for effective AI use.**

### Beyond "Vibing" with AI

AI is much better at being impressive compared to being correct. There's a lot of excitement in creating quick prototypes using AI without understanding what the code does. This can be useful but it is not software engineering. It's closer to sketching, wireframing, exploring.

Although impressive demos get attention, the vast majority of effort is spent on non-prototypes. And there is a lot more gain to be had in optimizing actual engineering workflows.

## The Core Workflow

The most effective AI-assisted development follows a structured approach: **Plan → Act → Review → Repeat**. This isn't just good practice - it's essential for avoiding the common pitfalls that lead to frustration and wasted time.

### Plan

![Planning Phase Workflow](/blog/images/articles/ai-flow-planning-phase.avif)

Keep the agent in discussion mode - no code execution yet. Provide necessary context. For complex features, thorough planning preserves the necessary context between executions.

The amount of planning needed depends on the task. Small tasks require minimal planning, but skipping planning for large tasks virtually guarantees poor results.

Planning needs substantial context. This is where tools like [Nx's AI integration](/features/enhance-AI) shine by providing agents with derived context about your codebase architecture, team responsibilities, and organizational boundaries. All of these helps LLMs and humans operate from the same architectural and organizational context.

For large changes, it's a good idea to persist the created plan to disk.

### Act

![Acting Phase Workflow](/blog/images/articles/ai-flow-acting-phase.avif)

Ask the agent to execute the plan.

Stay engaged. Monitor execution and check work in progress. Halt immediately if problems arise or new information emerges, then return to planning. Sometimes Agents can get stuck. If this happens, remind them of their original objective. A useful technique is to break the current task into smaller subtasks and have the agent focus on the first one.

An Agent's effectiveness increases dramatically when it can use higher-level operations. Without these, ensuring consistency and adherence to best practices becomes much harder. This primarily affects real organizations, not demo projects, as demos don't need to be correct or follow best practices. That was a big focus for us when developing Nx MCP (which provides many tools that help guarantee consistency and compliance with standards) because of us working with a lot of large companies with 1000s of engineers working in the same org.

Agents excel at being almost right but struggle with executing exactly what's required. Good interactions should include requesting user input for high-impact operations that are difficult to adjust later (like creating a new package). For instance, when using Nx, an Agent would open a UI with pre-filled generator options that users can modify and confirm. The Agent then continues the work from that point. Have a look at our [latest blog post for a deeper dive into what this looks like](/blog/nx-generators-ai-integration).

If things go sideways, don't hesitate to reset: dump context, revert changes, and start fresh. These tools drastically reduce "grunt work" costs, making restarts practical.

### Review

![Review Phase Workflow](/blog/images/articles/ai-flow-review-phase.avif)

Even though I try to keep a document where I note things that will require a follow-up, most likely won't keep pace with the agent's output. That's why it's important to do a thorough review afterward. Most often I make small changes directly, but sometimes I ask the agent to make them for me.

### Repeat

The process can vary, but it follows this general pattern.

**Common mistakes**: skipping either "Plan" or "Repeat" - both are essential. Do not skip them when working on real projects.

## Using Rules and Persistent Context

Every AI coding assistant offers automatic prompt inclusion: Cursor rules, Windsurf rules etc. These are essential for consistent output.

Keep it manageable - a few hundred lines work well. Your rules should document coding style, recurring patterns, and in some cases architecture. If you repeat yourself during development, encode it in rules.

For persistent prompts, create a human-readable version and let AI optimize it for machines. AI excels at prompt engineering - focus on tweaking, not creating from scratch.

### Example Workflow for Rules

1. Create `STANDARDS.md` with coding standards
2. Review with AI and request clarifications
3. Identify gaps (AI can help) and address them
4. Format standards appropriately
5. Update rules files

I have a Claude project where I discuss coding standards and other topics that often end up in rules files.

### For Working on Features

For every major PR I worked on, I often kept a notes document with the issue description, my thoughts, architecture notes, specs, TODOs, and progress. Turns out, wonderful things happen when you let AI see it.

Maintain a `PR.md` at project root. Start with issue instructions and update it with any relevant information about the PR you are working on. With this, you can instantly provide context in any chat.

Create implementation steps and save the checklist in `PR.md`. Start separate chats for each step, checking off as you complete them. Add new steps as things become clearer.

## Quick Recommendations

### Documentation & Planning

- Use AI to document - documentation costs drop 10x with AI assistance
- Leverage AI for planning - preparation costs decrease drastically
- Explicitly reference examples to produce consistent documents
- Use Claude Projects (or other similar affordances) to improve repeatability

### Debugging & Fixing

- Always plan/ask before fixing a non-trivial issue
- Paste a stack trace and ask to explain what caused it. AI is very good at this.
- When dealing with non-trivial problems, ask for several solutions

### Session Management

- Commit code frequently (you will undo often)
- Keep chat sessions short to prevent context drift
- Start fresh chats for each issue/task
- If you use Claude Code, use "/compact" to keep a summary in the context.
- If not available, do an ad-hoc compact by requesting a summary before starting a new chat

### Task Structure

- Plan first, then divide into incremental tasks
- Keep individual tasks straightforward and simple
- Focus on iterative tasks - AI performs better with focused objectives

### Coding Approach

- Maintain consistent code style - AI generates better matches when surrounding code is consistent
- Avoid clever solutions - AI is much better at dealing with boring code
- Use well-known idioms - AI knows them and can process them very effectively
- Use AI to generate or modify tests. Tests are often linear, simple and formulaic. AI excels at manipulating such code.

## Handling Hallucinations

Hallucinations remain a significant challenge for LLMs, though the problem has improved over the past year. If a solution seems suspiciously perfect, prompting the AI with "are you sure?" often triggers self-correction. This issue is diminishing as more tools provide MCP servers with access to current documentation. The Nx MCP server, for example, reduces hallucinations by providing direct access to up-to-date documentation.

## Understand What Models are Good At

Every AI journey follows the same arc: initial awe at its superhuman abilities, then disillusionment when it fails at basic math or fabricates facts, before finally reaching a balanced understanding of AI's strengths and limitations.

## AI as a Mighty Refactoring Tool

AI excels with formulaic, pattern-based code - much like a powerful template engine. **Tests represent the perfect application**: developers can achieve higher quality and greater coverage while investing significantly less time.

Similarly, AI transforms documentation from time-consuming to nearly effortless. The cost approaches zero for both inline module comments and comprehensive documentation files, eliminating any practical excuse for poor documentation.

Code translation tasks - converting between natural language and programming syntax - also benefit tremendously from AI assistance, dramatically accelerating these previously tedious processes.

Once you recognize that AI can make some operations almost free while others remain beyond its reach, you start structuring your work differently. You divide tasks into units where AI can handle specific parts in isolation. It's like refactoring tools—knowing they can make certain transformations free changes how you approach large code changes.

## AI as a Debugger

When I work on distributed systems and hit a problem, AI rarely offers an immediate solution, but it's still invaluable. Explaining complex problems to a system capable of understanding often reveals connections your mind hasn't made.
Effective AI debugging strategies:

- Ask "What is missing?" when evaluating a theory
- Ask for alternative theories
- Use AI to organize and format disorganized thoughts
- Also, AI excels at pattern matching, so feed it logs and see what it finds.

Nx 21+ can pipe its terminal output (and other information) to your AI agent, so you can simply ask "Why is my command failing?"

## AI as Stack Overflow

AI delivers immense value as an educational tool. Unlike static resources, AI enables true dialogue. You can:

- Ask questions in any format
- Request simplified explanations when confused
- Test your understanding by explaining concepts back
- Take personalized quizzes
- Receive evaluations of your comprehension
- Get recommendations for logical next learning steps

Make sure the AI gets this information through web search to provide up-to-date results.

Another technique I use is when learning a new tool, I provide the website URL and ask Claude to review the entire site to answer a set of questions. This saves me hours of research and lets me explore documentation in a very different way.

Similar to Stack Overflow, AI can have a negative effect on learning because it provides answers without the supporting information needed to build a mental model and understand why the answer makes sense. For me, it's not a replacement for a good book or course, but a good complementary tool.

## The Long View: Building Sustainable AI Workflows

The trajectory is clear: developers who invest in proper AI workflows and understand the tools' capabilities will have a growing competitive advantage. **The key is being intentional about your approach rather than hoping that better prompts will magically solve workflow problems.**

Start small, experiment with the patterns outlined here, and gradually build your AI-assisted development skills. The investment in learning proper workflows pays dividends as the technology continues to evolve.

---

Learn more:

- 🧠 [Nx AI Docs](/features/enhance-AI)
- 📖 [Nx and AI: Why They Work so Well Together](/blog/nx-and-ai-why-they-work-together)
- 📖 [Combining Predictability and Intelligence With Nx Generators and AI](/blog/nx-generators-ai-integration)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 👩‍💻 [Nx Console GitHub](https://github.com/nrwl/nx-console)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
