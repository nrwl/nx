---
title: 'Nx and AI - Why They Work so Well Together'
slug: nx-and-ai-why-they-work-together
authors: ['Victor Savkin']
tags: ['nx', 'ai', 'monorepo']
cover_image: /blog/images/articles/bg-nx-and-ai-powered-dev.avif
description: 'Explore how Nx monorepos amplify AI benefits by providing complete context and consistent tooling, creating a growing competitive advantage for enterprise development.'
---

{% callout type="deepdive" title="Series: Making your LLM smarter" expanded=true %}

- [Nx Just Made Your LLM Way Smarter](/blog/nx-just-made-your-llm-smarter)
- [Making Cursor Smarter with an MCP Server For Nx Monorepos](/blog/nx-made-cursor-smarter)
- [Nx MCP Now Available for VS Code Copilot](/blog/nx-mcp-vscode-copilot)
- **Nx and AI: Why They Work so Well Together**
- [Save Time: Connecting Your Editor, CI and LLMs](/blog/nx-editor-ci-llm-integration)
- [Enhancing Nx Generators with AI: Predictability Meets Intelligence](/blog/nx-generators-ai-integration)
- [Your AI Assistant Can Now Read Your Terminal: Real-Time Development Error Fixing](/blog/nx-terminal-integration-ai)

{% /callout %}

**TLDR:**

1. **Monorepos Amplify AI Benefits**: Monorepos inherently enhance the utility of coding assistants by providing complete context, creating a growing competitive advantage.
2. **Consistency is Key**: The primary challenge with AI coding assistants is maintaining consistency and reliability. This affects both AI and human developers' future effectiveness, but can be mitigated with Nx capabilities.
3. **Integrated Tooling**: Tools connecting CI, editors, and coding assistants create powerful development workflows.
4. **Mitigated Downsides**: Traditional monorepo disadvantages (like the necessity for large-scale code changes) can be effectively addressed with agentic AI.
5. **Cross-Repository Context**: Benefits extend beyond single repositories to connected repositories using Nx Cloud Polygraph.

{% toc /%}

{% call-to-action title="Are Monorepos the Answer to Better AI-Assisted Development?" url="https://go.nx.dev/april2025-webinar" description="Upcoming webinar: save your spot" /%}

## It's All About Context

> _"Context is worth 80 IQ points." — Alan Kay_

Why do tools like Bolt.new work so well for streamers and indie developers bootstrapping new projects but not so much for enterprise developers that work on an existing large codebase? The answer is context. With Bolt, an LLM can access the entire context of a smaller repo, making local changes with short-term considerations.

Enterprise systems present a different challenge:

- Highly complex and interdependent
- Built by hundreds of engineers over many years
- Often spread across hundreds of repositories
- Integrated with numerous external systems

In these environments, **LLMs lack the necessary context to make changes that account for all considerations**. Like human developers, LLMs struggle with complex systems, but unlike humans, they don't have tacit knowledge from wikis, meetings, or informal conversations. As a result, they only see a small fraction of the system.

![LLMs with limited context can only see a small fraction of the system](/blog/images/articles/nx-ai-limited-context-problem.avif)

LLMs rely entirely on provided context. Because monorepos consolidate all code in one place, they fundamentally improve contextual access. However, **raw code access isn't enough. It's analogous to navigating a city using only street view.** This makes it unlikely to pick optimal routes.

![Navigating code with raw access only is like using street view without a map](/blog/images/articles/nx-ai-street-view-problem.avif)

**What's needed is a "map" of your codebase and organization. Nx via its plugins builds this "map".** It includes:

1. High-level repository structure
2. System architecture
3. Organizational structure and ownership
4. Information about used tools, frameworks, their versions and dependencies
5. CI information (frequency, failures)

This information is used to make CI execution fast, to ensure boundaries, and now **Nx provides this information to [coding assistants through MCP servers](/features/enhance-AI), enabling LLMs to answer questions like**:

- "Who should I consult about creating a new bank library for overdraft payments?"
- "Create a library using the bank team's best practices."
- "Identify and suggest fixes for circular dependencies."
- "Which shared libraries does the overdraft library depend on? Which teams own them?"
- "Which projects owned by my team fail frequently in CI? Which ones affect other teams' work?"

![Nx provides a 30,000-foot view map of your entire system](/blog/images/articles/nx-ai-map-view-visualization.avif)

With this map, Nx provides a "30,000-foot view" of the entire system (architecture, organization, CI). Coding assistants are able to read relevant files and see the 0-foot view. This combination creates very powerful interactions.

But we are working on providing a "10,000-foot view" by compressing relevant content about projects and project clusters in the repository. Another way to think of this is **"d.ts" files for AI coding assistants**. With this, your coding assistant is able to jump between different abstraction levels to get relevant information.

![Different abstraction levels help AI understand your codebase better](/blog/images/articles/nx-ai-abstraction-levels.avif)

## Beyond Speed: Writing Correct and Consistent Code

> _"It is better to take many small steps in the right direction than to make a great leap forward only to stumble backward." — Chinese Proverb_

Research shows enterprise developers commit only 20-30 lines of code daily. The bottleneck isn't coding speed but determining the correct approach to minimize technical debt and long-term impact.

Enterprise developers spend 90%+ of their time not actively writing code. **LLMs excel at generating code, and if that's what they are used for, they can only help with that 10% of the development process.**

To realize substantial gains we need to:

1. Enable LLMs to help with the 90% by providing better context (see section above)
2. Ensure generated code is correct, consistent with the organization's best practices, and doesn't introduce technical debt

Without these considerations, you might be 5x more productive in the first month but progressively slower throughout the year due to accumulated technical debt. So you might not even break even.

### Consistency Through Best Practices and Metadata

One way to minimize technical debt is by codifying and reusing best practices:

**Human Approach**:

- Senior developers examine feature libraries from the bank team
- They identify common patterns and create a local plugin with a generator
- They teach other developers about the new generator

**LLM Approach**:

- Developers ask LLM powered by Nx to extract common patterns from all bank libraries
- LLM creates a local plugin with a generator for bank libraries
- Developer refines the generator
- Another developer requests a new bank feature library
- LLM finds and runs the new generator in dry-run mode for confirmation
- LLM can open a generator UI for parameter tweaking
- Developer selects parameters and generates code
- LLM picks it up and offers additional customization

You don't have to create libraries reflecting organization's best practices. Nx plugins come with many generators.

The reason why this approach works with Nx is that everything in Nx (including [its generators](/features/generate-code)) comes with a lot of static metadata. Traditionally this metadata was used to power the terminal UI, graphic UI, docs and more. Turns out it's also extremely useful for LLMs. **With this metadata they know all the inputs into each generator and what each of them does. But it gets better! Nx's virtual file system lets LLMs run the generators in dry run mode to get the generator outputs.** With this, LLMs can derive which generators work well with which parameters. **Additional metadata specifically designed for LLMs is being added.**

LLMs excel at impressive demonstrations but struggle with consistency and correctness. This is why they work better for new applications where correctness is loosely defined and consistency is not important. Being able to access a large library of annotated generators helps LLMs reduce variability of what they generate, which improves consistency and quality. They use a generator and make some small modifications on top instead of trying to author everything from scratch.

### Migrations

[Nx Migrations](/features/automate-updating-dependencies) are special generators that update codebases to use newer tool versions and new APIs. AI agents can enhance this process with specialized metadata for validation and fixes.

### Human in the Loop

Human oversight remains crucial as AI is good at being "almost correct." Having a human in the loop, especially for high-impact operations, helps with the need to correct what LLMs generate. Nx offers a tool that lets LLMs open the generator UI and allows the developer to customize and preview what will be generated.

## The Integrated Development Advantage: Multiplying AI's Power

> _"The whole is greater than the sum of its parts." — Aristotle_

The utility of your coding assistant goes up significantly as the number of tools it can access increases, which includes the rest of your editor and IDE and your local tools. Nx has always believed in this, and that's why we always put so much effort into our VSCode and IntelliJ plugins. The bet paid off. With agentic AI being available, the value of those plugins is going up 10x.

This is the sketch I drew a while back, and we have been moving toward this vision:

![Integrated development tools and AI systems working together seamlessly](/blog/images/articles/nx-ai-integrated-tools-vision.avif)

**These are some of the things Nx either already does or is about to do in the next couple of weeks:**

1. Coding assistants can open and manipulate the [Nx project graph visualization](/features/explore-graph).
2. Coding assistants are able to open the generation UI, prefill the right values.
3. Coding assistants are able to fetch up-to-date docs to ensure they don't hallucinate.
4. Coding assistants get notified about CI execution results while the CI is still running. The assistant gets relevant logs and files and is able to explain or fix the CI error and push changes before the CI execution even completes.
5. Coding assistants will integrate with the new Nx interactive UI so they can see what the developer sees and are able to address issues while the Nx command is still running. **Tell the LLM to fix the error, and it will know what error you are looking at.**

## From Pain Points to Power Moves

> _"What was once impossible becomes merely difficult; what was difficult becomes easy; and what was easy becomes elegant." — Alan Kay_

Monorepos offer many benefits but come with caveats. The main concern is managing large-scale changes across the repository, such as updating all applications to the latest React version.

Nx has always addressed this with ["migrations" - specialized generators](/features/automate-updating-dependencies) optimized for such tasks. Typically, migrations handle 80% of the work, with the remaining 20% potentially taking weeks for a small team in large repos.

This is precisely where agentic coding assistants excel. **By building on Nx's migration capabilities, AI increases completion from 80% to a much higher percentage, reducing effort from weeks to days or even hours.** What was difficult becomes easy.

The ability to update all code simultaneously is also a significant benefit of monorepos. Small changes like renaming can be executed in a single step, eliminating entire classes of "breaking" changes. Your code is less defensive. This is a huge advantage preventing your code from becoming stale. It's a form of economy of scale, where you can make a code cleanup for a dozen applications in a time that is a tiny fraction of what it would have taken if they were in separate repos.

**Agentic coding assistants significantly expand the range of "reliable transformations" that can be done quickly, turning what were before long refactorings into minutes-long tasks. With this, the delta between what you can do in a monorepo compared to a polyrepo gets substantially more significant.**

## Repository Interconnectedness: Breaking Down the Final Silos

> _"Silos create boundaries. Networks create possibilities." — Anonymous_

This document was about Nx monorepos. But most organizations using Nx have dozens or hundreds of Nx repos and oftentimes hundreds or thousands of other repos as well. Because we recognize this reality, we built **Nx Polygraph** (available for [Nx Enterprise users](/enterprise)) which lets you connect multiple repositories into a federated meta-repo. With this, you will get some of the advantages outlined in this document in H1 2025.

## The Long View: Designing for AI's Continued Evolution

_"The path of technological progress is neither random nor accidental, but follows paths of least resistance toward inevitable destinations." — Kevin Kelly_

Some might argue that coding assistants aren't that reliable now and perhaps some of the benefits aren't realizable. A lot of it is new ([VSCode MCP support is a few weeks old](/blog/nx-mcp-vscode-copilot)) so we are working hard to provide the necessary context to them, and not everything at this point is as good as it should be. What matters though is not the current state but the direction.

**Many advantages are inherent to Nx's approach:**

- Consolidating information
- Providing a navigable "map" of the codebase
- Using metadata-driven generators and migrations that are inherently LLM-friendly
- Enabling large-scale transformations in a monorepo

Although it's not entirely impossible, it is significantly harder to provide the same advantages in a polyrepo where information isn't consolidated, where there is no "map", where there is no codification of best practices, where cross-cutting code changes are effortful and non-atomic.

**The trajectory is clear: monorepos with tools like Nx are positioned to leverage AI capabilities more effectively as the technology evolves.**

---

Learn more:

- 🧠 [Nx AI Docs](/features/enhance-AI)
- 📖 [Nx MCP Now Available for VS Code Copilot](/blog/nx-mcp-vscode-copilot)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 👩‍💻 [Nx Console GitHub](https://github.com/nrwl/nx-console)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
