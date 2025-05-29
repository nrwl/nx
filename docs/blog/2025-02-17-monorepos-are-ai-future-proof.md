---
title: 'Nx Just Made Your LLM Way Smarter'
slug: nx-just-made-your-llm-smarter
authors: ['Juri Strumpflohner']
tags: ['nx']
description: 'Learn how monorepos with Nx enhance AI capabilities by providing rich metadata and context, making LLMs smarter and more architecturally aware.'
cover_image: /blog/images/articles/monorepos-are-ai-future-proof-bg.jpg
youtubeUrl: https://youtu.be/RNilYmJJzdk
---

{% callout type="deepdive" title="Series: Making your LLM smarter" expanded=true %}

- **Nx Just Made Your LLM Way Smarter**
- [Making Cursor Smarter with an MCP Server For Nx Monorepos](/blog/nx-made-cursor-smarter)
- [Nx MCP Now Available for VS Code Copilot](/blog/nx-mcp-vscode-copilot)
- [Nx and AI: Why They Work so Well Together](/blog/nx-and-ai-why-they-work-together)
- [Save Time: Connecting Your Editor, CI and LLMs](/blog/nx-editor-ci-llm-integration)
- [Enhancing Nx Generators with AI: Predictability Meets Intelligence](/blog/nx-generators-ai-integration)
- [Your AI Assistant Can Now Read Your Terminal: Real-Time Development Error Fixing](/blog/nx-terminal-integration-ai)

{% /callout %}

Everyone is constantly pushing to be more productive: delivering more features, reducing overhead, and keeping up with increasing demands. Companies want to move faster, and engineering teams work toward the same goal, looking for ways to streamline development and ship more with fewer resources. LLMs offer a promising way to boost efficiency, whether by assisting individual developers or improving workflows across a team.

However, the quality of an LLM's response depends entirely on the data and context it has access to. Ask an LLM (in this case, GitHub Copilot with GPT-4o) about the structure of an NPM workspace monorepo, and you probably won't be satisfied with the result:

![nx-ai-before-workspace-structure.avif](/blog/images/articles/nx-ai-before-workspace-structure.avif)

Now compare that result, using the exact same question, but with additional context provided to the LLM:

![nx-ai-after-workspace-structure.avif](/blog/images/articles/nx-ai-after-workspace-structure.avif)

The difference is huge. Copilot now understands the architectural structure of the workspace. It recognizes that there are apps and libraries, their types (such as "data access" libraries), and how each relates to other projects in the monorepo.

![nx-ai-after-workspace-structure2.avif](/blog/images/articles/nx-ai-after-workspace-structure2.avif)

**So what changed?** Let's break it down.

{% toc /%}

## Monorepos Break Down Barriers

When we (at Nx) [work with large enterprises](/enterprise), we often see patterns that lead to inefficiencies:

- **Siloed knowledge** – Developers only have visibility into the areas they actively work on. Without a broader view, duplication increases, communication slows down, and collaboration suffers.
- **Fragmentation** – Code is spread across multiple repositories with little integration. LLMs don't automatically understand how different projects connect or who owns what.
- **Lack of integration** – Many productivity bottlenecks come from friction at integration points between teams.

LLMs face the same challenges. They operate on a small scope, usually a few files at a time, but **lack architectural awareness**. They don't know how projects relate to each other, where the integration points are, or which team owns a given project.

Monorepos solve visibility and fragmentation issues by consolidating related projects into a single repository. This gives teams a shared view, removes communication barriers, reduces duplication, and improves collaboration.

**The same visibility that helps developers also helps an LLM.** Think about it: when you open your monorepo in VSCode or Cursor, you can see multiple related projects in one place. That's very different from working across scattered repositories.

The problem? Even though your entire codebase is accessible, an LLM still only sees files and their contents. It doesn't understand which project a file belongs to or how that project interacts with others. It simply lacks that knowledge.

This is where Nx comes in.

## Nx Understands Your Monorepo

Monorepos don't come for free. While they improve visibility and collaboration, they introduce scaling challenges. This is where tools like Nx step in, helping you get the benefits of a monorepo while managing the complexity that comes with it.

Over the years, we've built features like [Nx Replay](/ci/features/remote-cache) and [Nx Agents](/ci/features/distribute-task-execution) to keep CI fast, while [conformance rules](/nx-enterprise/powerpack/conformance), [ownership](/nx-enterprise/powerpack/owners), and [local repository automation](/extending-nx/intro/getting-started) help manage and scale a monorepo in the long run.

To power these features, **Nx collects metadata about your workspace**, understanding relationships between projects, ownership, technology types, available tasks, and more. The [Nx daemon](/concepts/nx-daemon) runs in the background, keeping this metadata up to date and making sure Nx operates efficiently.

**Nx understands project relationships down to the file level**, tracking dependencies. For example, in the image below, `src/app/app.tsx` imports a component from `@aishop/feat-create-order`, and Nx knows exactly how these projects connect.

![nx-ai-project-relationships.avif](/blog/images/articles/nx-ai-project-relationships.avif)

**Nx also tracks available targets for each project**. If you're using [Code Owners](/nx-enterprise/powerpack/owners), it **knows who owns what within your monorepo**.

![nx-ai-project-detail-view.avif](/blog/images/articles/nx-ai-project-detail-view.avif)

It **identifies relevant files for each target** based on the input and output properties defined in the [cache configuration](/features/cache-task-results#finetune-caching-with-inputs-and-outputs).

![nx-ai-cache-inputs.avif](/blog/images/articles/nx-ai-cache-inputs.avif)

Nx also knows about **project tags, helping classify domains, project types, or any other custom attributes** you've applied.

![nx-ai-project-tags.avif](/blog/images/articles/nx-ai-project-tags.avif)

Nx plugins come with **[code generators](/features/generate-code)** that can scaffold entire projects. These generators have well-defined [schemas](https://github.com/nrwl/nx/blob/804df721a729da41d804c57a829828c96d265d79/packages/js/src/generators/library/schema.json) that describe the available properties, their descriptions, and which ones are required. This structured metadata makes them an ideal data source for LLMs, allowing them to provide more accurate and meaningful suggestions when interacting with your monorepo.

![nx-ai-generator-schema.avif](/blog/images/articles/nx-ai-generator-schema.avif)

These are just some examples of the metadata Nx maintains about your monorepo.

Beyond that, the [Nx documentation already includes an AI-powered chat](/ai-chat), and its data can be injected directly into your LLM conversations as well.

![nx-ai-docs-assistant.avif](/blog/images/articles/nx-ai-docs-assistant.avif)

## Nx Makes Your LLM Way Smarter

All of this data is a goldmine for enhancing your LLM. Luckily we're kinda obsessed with good DX which is why we had an editor for a long time: [Nx Console](/getting-started/editor-setup).

While you could build your own chat-based LLM integration, the best approach is to make it work where developers already spend their time: inside the editor. Nx Console is the perfect fit for this. It already enhances your monorepo workflow by providing IntelliSense, running code generators, and [integrating with CI](/blog/nx-cloud-pipelines-come-to-nx-console). Now, we've taken it a step further.

We extended Nx Console with an integration for Copilot that preprocesses Nx metadata and provides the LLM with details about:

- The workspace structure, including applications and libraries.
- How projects are connected.
- A project's technology stack.
- Tasks and which files are relevant for each task (e.g., spec files for test runs).
- Categorization via tags and dependency rules.
- Project ownership information.
- …

The result: **your LLM just got significantly smarter**, moving beyond basic file-level reasoning to understanding your workspace at an architectural level.

Let's go through some concrete examples. You can try these yourself by [installing Nx Console](/getting-started/editor-setup) or updating to the latest version.

Here, we ask Copilot about projects, their dependencies, and ownership details:

![nx-ai-example-project-data.avif](/blog/images/articles/nx-ai-example-project-data.avif)

We can also go deeper, asking where to best implement certain types of functionality:

![nx-ai-example-data-access-feature.avif](/blog/images/articles/nx-ai-example-data-access-feature.avif)

In a larger enterprise, this also means you can ask about who to talk to when implementing or planning a new feature. Thanks to Nx metadata, the LLM understands ownership:

![nx-ai-example-ownership.avif](/blog/images/articles/nx-ai-example-ownership.avif)

And since we made the LLM aware of [Nx generators](/features/generate-code), we can ask it to help set up a new project. Notice how it not only suggests the correct command but also places the new project in the `packages/products` subfolder. We even added action buttons to either run the command immediately or open it in [Nx Console's generator UI](/recipes/nx-console/console-generate-command).

![nx-ai-example-generate-code.avif](/blog/images/articles/nx-ai-example-generate-code.avif)

Beyond that, since we also feed documentation data into the LLM, it can now answer questions about Nx itself:

![nx-ai-example-cache-config.avif](/blog/images/articles/nx-ai-example-cache-config.avif)

## Nx Monorepos Are AI Future-Proof

Right now, most LLM editor extensions operate at the file level, unless you manually feed them additional context. But this is going to change. LLMs will continue to improve, and most importantly, their context windows will grow.

That's why **we strongly believe monorepos are AI future-proof**. They provide a consolidated view of multiple projects, and when enhanced with Nx metadata, they allow an LLM to reason at a higher architectural level. Instead of just answering file-specific questions, it can assist with broader development workflows, project structure, and cross-project interactions.

And this is just the beginning. While Nx already understands your local monorepo, [Nx Cloud](/nx-cloud) holds valuable CI-related data, tracking which tasks take the longest, where failures are most common, identifying flaky tasks, and even mapping project relationships beyond a single monorepo. Combining local workspace metadata with Nx Cloud insights creates an even richer foundation for LLMs, unlocking more meaningful suggestions and optimizations.

## Try It Out Yourself

If you want to test this out, [create a new Nx workspace](/getting-started/intro#try-nx-yourself) and make sure you have [Nx Console](/getting-started/editor-setup) installed or updated to the latest version.

> If you already have an existing NPM/Yarn/PNPM workspace, you can add Nx with `nx init`. Check out [our free course](/courses/pnpm-nx-next) to learn more.

While Nx Console is also available for WebStorm, the AI-powered extensions currently only work with VSCode and Copilot.

---

Learn more:

- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
