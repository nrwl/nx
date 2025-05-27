---
title: 'A Practical Guide on Effective AI Use - AI as Your Peer Programmer'
slug: practical-guide-effective-ai-coding
authors: ['Victor Savkin']
tags: ['ai', 'development', 'productivity', 'best-practices']
cover_image: /blog/images/articles/bg-practical-ai-guide-part-1.avif
description: 'Learn how to effectively use AI coding assistants beyond simple prompts. Discover proven workflows, best practices, and strategies that transform AI from a novelty into a powerful development multiplier.'
---

> _"Tools amplify your talent. The better your skills, the better the tools serve you."_ — Andrew Hunt, The Pragmatic Programmer

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
- Reduced mental fatigue
- Accelerated skill acquisition in unfamiliar areas

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
- **ChatGPT** - Image creation, superior web search, research capabilities (less code-proficient than competitors)
- **AI Studio (Gemini)** - Massive context window, code-optimized models, Google search integration
- **T3 Chat** - A fast web-based chat client that allows you to switch between multiple models and comes with a competitive, convenient pricing approach.
- **ChatWise** - A desktop-based chat client that uses a bring-your-own-key strategy, allowing you to integrate with all the models out there. You can provision a key via [OpenRouter](https://openrouter.ai/) or directly plug in the key.

All three are comparable - consistency matters more than choice. I personally value MCP integrations, so primarily use Claude Desktop.

**Model Control Protocols (MCPs)** are plug-and-play tools that AI can use to fulfill requests. They're remarkably quick to create and integrate with most agent-based tools and Claude desktop. MCPs are particularly valuable as they can enhance any of the above tool categories, providing specialized capabilities and integrations that extend the base functionality of AI coding assistants. This is exactly how we integrate Nx's capabilities with existing coding assistants like VS Code Copilot and Cursor - [learn more about our MCP implementation](/blog/nx-mcp-vscode-copilot).

### Agent Types

The most important type of tool you would use while coding is an Agent. Most of the AI work you do in Cursor, Windsurf or JetBrains is done via Agents. You can chat with agents to instruct it to do several things to your code base. Agents have built-in capabilities (integrating with your editor) and can be extended via MCP.

**There are two styles of agents:** interactive and non-interactive

### Interactive Agents (Quick Doers)

These are your everyday workhorses for AI-assisted coding. They're quick, cost-effective, but with some capability limitations.

**Recommended options:**

- **Cursor** (VSCode fork)
- **Windsurf** (Available as VSCode fork or JetBrains plugin)
- **Copilot** (VSCode native integration; approximately 70% as effective as Cursor/Windsurf but improving fast)

### Non-interactive Agents (Deep Thinkers)

More precise than interactive assistants but slower and pricier - like precision power tools versus hand tools. These excel at widespread codebase changes requiring sub-agents or extensive context.

**Recommended options:**

- **Claude Code** (terminal-based interface)
- **OpenAI Codex** (terminal-based interface)
- **JetBrains Junie**
- **Aider** (budget option with some quality trade-offs)

They get less attention online because most streamers do work that works well with interactive agents. Any agent can put together a web page. Deep thinkers can spend many minutes performing an operation which doesn't make for impressive videos, but they're very valuable when working on real complex systems.

Most of my work involves distributed systems, where interactive agents aren't particularly effective. In these systems, application behavior isn't easily derivable from source code—things operate at a higher level of abstraction.

I get significantly more leverage from tools like Claude Code (or Junie) than Cursor/Copilot, which create more robust plans and provide real value in my domain. Even with Claude Code I use specific patterns and prompt and keep it on a short leash.

For tasks like writing new scripts or building web UIs, I find Copilot or Cursor work better.

## The Prime Directive: Understanding over Speed

> Never commit code you don't fully understand.

While AI may write it, you are responsible for every character. Understanding your code completely is essential. Read, understand, investigate the code that AI generates.

If AI generates subpar code, it's your duty to improve it and learn how to get better results. The goal is AI that produces what you would have written yourself.

**Effective AI use means:**

- More thinking
- More reading
- Less typing

If that's not happening, you're off track.

These tools create space for better engineering practices and quality improvements - not just cramming in more features. **Critical thinking and deep codebase familiarity remain essential. They're the foundation for effective AI use.**

### Beyond "Vibing" with AI

AI is much better at being impressive compared to being correct. There's a lot of excitement in creating quick prototypes using AI without understanding what the code does. This can be useful but it is not software engineering. It's closer to sketching, wireframing, exploring.

Although impressive demos get attention, the vast majority of effort is spent on non-prototypes. And there is a lot more gain to be had in optimizing actual engineering workflows.

## The Core Workflow

The most effective AI-assisted development follows a structured approach: **Plan → Act → Review → Repeat**. This isn't just good practice - it's essential for avoiding the common pitfalls that lead to frustration and wasted time.

If things go sideways, don't hesitate to reset: dump context, revert changes, and start fresh. These tools drastically reduce "grunt work" costs, making restarts practical.

### Plan

![Planning Phase Workflow](/blog/images/articles/ai-flow-planning-phase.avif)

Keep the agent in discussion mode - no code execution yet. Provide necessary context. For complex features, thorough planning preserves "memory" between executions. Most tasks don't require this depth, but skipping planning virtually guarantees poor results.

Planning needs substantial context. This is where tools like [Nx's AI integration](/features/enhance-AI) shine by providing agents with derived context about your codebase architecture, team responsibilities, and organizational boundaries. All of these helps LLMs and humans operate from the same architectural and organizational context.

For large changes, it's a good idea to persist the created plan to disk.

### Act

![Acting Phase Workflow](/blog/images/articles/ai-flow-acting-phase.avif)

Release the agent to execute the plan (say: execute the plan).
Stay engaged. Monitor execution and check work in progress. Halt immediately if problems arise or new information emerges, then return to planning.

Agents can get stuck in loops; stop and redirect them when this happens. Mental disengagement here dramatically increases the chance of poor code requiring a restart. An Agent's effectiveness increases dramatically when it can use higher-level operations. Without these, ensuring consistency and adherence to best practices becomes much harder.

This primarily affects real organizations, not demo projects, as demos don't need to be correct or follow best practices. That was a big focus for us when developing Nx MCP (which provides numerous tools that help guarantee consistency and compliance with standards) because of us working with a lot of large companies with 1000s of engineers working in the same org.

Agents excel at being almost right but struggle with executing exactly what's required. Good interactions should include requesting user input for high-impact operations that are difficult to adjust later (like creating a new package). For instance, when using Nx, an Agent would open a UI with pre-filled generator options that users can modify and confirm. The Agent then continues the work from that point. Have a look at our [latest blog post for a deeper dive into what this looks like](/blog/nx-generators-ai-integration).

### Review

![Review Phase Workflow](/blog/images/articles/ai-flow-review-phase.avif)

You likely won't keep pace with the agent's output, so thorough review is essential afterward. Make small changes directly if needed - using an agent doesn't mean you stop writing code. This should be collaborative.

If you modify code, ask the agent to evaluate your changes. Use git extensively so you can always reset if needed. Don't accept subpar code - improve your tool usage to get the results you expect.

### Repeat

The process is rarely linear and often varies, but follows this general pattern. Success comes from developing intuition about which direction to take at each stage - this isn't a rigid playbook. Building this intuitive sense requires practice, reflection, and time.

**Common mistakes**: skipping either "Plan" or "Repeat" - both are essential. Do not skip them when working on real projects.

## Using Rules and Persistent Context

Every AI coding assistant offers automatic prompt inclusion: Cursor rules, Windsurf rules, Junie's `.junie/guidelines.md`. These are essential for consistent output. Files and rules give you "memory" between sessions.

Keep it manageable - 100-300 lines works well. Your rules should document coding style, recurring patterns, and codebase navigation. If you repeat yourself during development, encode it in rules.

For persistent prompts, create a human-readable version and let AI optimize it for machines. AI excels at prompt engineering - focus on tweaking, not creating from scratch.

### Example Workflow for Rules

1. Create `CODING.md` with coding standards
2. Review with AI and request clarifications
3. Identify gaps
4. Request quantitative assessment
5. Format standards appropriately
6. Generate optimized rules
7. Update rules files

### For Feature Work

Maintain a `FEATURE.md` at project root. Start with ticket instructions and develop something RFC-like. Use AI as engineering partner, rubber duck, and technical writer - handling grunt work while you focus on complex thinking.

With your feature document ready, you can instantly provide context in any chat. Create implementation steps with AI assistance and save as a `PROGRESS.md` checklist.

Start separate chats for each step, checking off as you complete them. Remain flexible when pivots become necessary.

These techniques amplify what great programmers already do, but with more structure and effectiveness than traditional approaches. AI assistance makes these practices significantly more powerful.

## Quick Recommendations

### Code Quality & Documentation

- Maintain consistent code style - AI generates better matches when surrounding code is well-formatted
- Use AI to document - documentation costs drop 10x with AI assistance
- Leverage AI for planning - preparation costs decrease drastically

### Debugging

- Always plan/ask before fixing - avoid tunnel vision and loops
- When encountering errors, follow this sequence:
  1. Ask "What broke? Why?" and paste the stack trace
  2. If response makes sense, request "List 1-3 solutions that could fix this problem"
- Be aware that AI excels at stack trace analysis but can get stuck in loops when autonomously fixing test failures

### Session Management

- Commit code frequently to create recovery checkpoints
- Keep chat sessions short to prevent instruction forgetting and context drift
- Start fresh chats for each issue/task
- For lengthy sessions, request a summary before starting a new chat

### Task Structure

- Avoid building large features in single attempts
- Plan first, then divide into incremental tasks
- Keep individual tasks straightforward and simple
- Focus on iterative tasks - AI performs better with focused objectives

### Coding Approach

- Avoid clever solutions - stay within community idioms
- Remember AI performs pattern matching - code resembling internet examples gets better results
- Use interactive agents for implementation, not questions
- Seek answers in web interfaces or higher-quality agents before implementation
- Learn to distinguish routine vs. non-routine tasks and adjust your approach accordingly

## Handling Hallucinations

Hallucinations are one of the biggest issues with LLMs. You'll develop instincts for when you're in risky territory - like when AI suggests a perfect-sounding method that doesn't actually exist.

AI excels at inventing plausible solutions that match a library's style but aren't implemented, especially with less mainstream libraries. Standard libraries rarely trigger this issue.

Usually, asking "Is this correct?" prompts self-correction, though not always. When hallucinations persist, providing concrete information - official documentation or source code - typically resolves the problem.

**Remember:** AI often surpasses human performance in many areas, creating a tendency toward excessive trust. Yet when AI makes mistakes, they're often errors no human would make. **Developing a balanced understanding of model capabilities is essential for effective AI-assisted development.**

## AI's Sweet Spots

### Repetitive Code Tasks

AI excels with formulaic, pattern-based code - much like a powerful template engine. **Tests represent the perfect application**: developers can achieve higher quality and greater coverage while investing significantly less time.

Similarly, AI transforms documentation from time-consuming to nearly effortless. The cost approaches zero for both inline module comments and comprehensive documentation files, eliminating any practical excuse for poor documentation.

Code translation tasks - converting between natural language and programming syntax - also benefit tremendously from AI assistance, dramatically accelerating these previously tedious processes.

### Complex Debugging Support

When tackling intricate problems spanning multiple systems, general-purpose AI chatbots won't deliver immediate solutions - but they remain valuable tools.

Think of AI as a sophisticated "rubber duck" - explaining complicated problems to a system capable of understanding often reveals connections your mind hasn't made.

Effective AI debugging strategies:

- Ask "What am I missing?" when evaluating hypotheses
- Request alternative approaches when generating theories
- Use AI to organize and format disorganized thoughts
- Have AI identify patterns in output

### Learning and Research

Beyond code generation, AI delivers immense value as an educational tool. Think of it as an interactive Wikipedia or Stack Overflow, custom-tailored to your specific learning needs.

Unlike static resources, AI enables true dialogue. You can:

- Ask questions in any format
- Request simplified explanations when confused
- Test your understanding by explaining concepts back
- Take personalized quizzes
- Receive evaluations of your comprehension
- Get recommendations for logical next learning steps

While AI doesn't replace a well-crafted book, it surpasses most online learning content. It adapts to your pace and style, filling gaps traditional resources leave.

This functionality extends beyond AI's training data - try pasting documentation or blog posts into Claude and engaging with that information through conversation. The ability to discuss and question transforms passive reading into active learning.

## The Long View: Building Sustainable AI Workflows

If things go sideways, don't hesitate to reset: dump context, revert changes, and start fresh. These tools drastically reduce "grunt work" costs, making restarts practical.

Remember to update your rules files with style corrections after each session - the AI can help review and integrate them.

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
