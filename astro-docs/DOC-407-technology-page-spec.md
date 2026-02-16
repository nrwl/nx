# DOC-407: Technology Hub Page Design Spec

**Linear Issue**: https://linear.app/nxdev/issue/DOC-407/propose-structure-and-content-for-technology-pages
**Created**: 2026-02-11
**Status**: Draft

## Goals

Define the design principles, information architecture, and content rules for technology "hub" pages under `astro-docs/src/content/docs/technologies/`.

A writer following this spec should be able to create a hub page for any technology — including ones not yet supported — without needing to reference other hub pages for structure decisions.

These pages exist to:

- Provide a single, reliable place to daily-drive a technology in Nx (setup, common tasks, configuration, CI basics).
- Reduce time-to-first-success with explicit, copy-pasteable steps and verification.
- Help both human developers and AI agents answer the most common “how do I…?” questions without guessing.

**80% coverage principle:** Hub pages should answer the most common questions for the majority of users (the “80%”), with clear pointers to deeper workflows elsewhere. If a detail is only relevant to a small subset, move it to a Knowledge Base page.

## What Belongs on a Hub Page

This is the single most important decision a writer makes: what goes on the hub page vs. a subpage.

**Hub page (introduction.mdoc)** = Everything most users need to daily-drive the plugin. Setup, common tasks, configuration, CI basics. The page someone bookmarks and returns to.

**Knowledge Base / subpages** = Specific workflows for specific scenarios. Recipes that only some users need.

### The Generality Test

Ask: "Will most users of this plugin encounter this?" If yes → hub page. If no → knowledge base subpage.

| Hub page content                | Knowledge base content                 |
| ------------------------------- | -------------------------------------- |
| Installing the plugin           | Deploying to a specific cloud provider |
| Running build/test/lint         | Configuring a niche bundler option     |
| Plugin options in `nx.json`     | Setting up SSR with Module Federation  |
| Switching compilers (TSC → SWC) | Migrating from Create React App        |
| Enabling remote caching         | Custom executor development            |
| What tasks the plugin infers    | Framework-specific test fixtures       |

When in doubt, start on the hub page. Content can always be extracted to a subpage later, but missing content on the hub page means users can't find what they need.

---

## Expected User Journey and Answers

Hub pages are expected to support a predictable user journey and resolve the most common questions quickly. This sequence should be true for every technology page:

1. **Understand** what the plugin provides and whether you need it (requirements, features).
2. **Add the plugin** to an existing workspace and verify it works.
3. **Configure existing projects** to use the tool (configuration generators).
4. **Create new projects** from scratch (if applicable for the category).
5. **Run daily tasks** with copy-pasteable commands.
6. **Configure inference and plugin options** — how the plugin reads existing config files, how to customize targets, how to exclude/include projects.
7. **Run in CI efficiently** — affected + caching, plus tool-specific optimizations (batch mode, atomizer, worker limits).
8. **Go deeper** with curated links to tutorials, recipes, and reference.

---

## Design Principles

These principles apply to every hub page regardless of technology. They are non-negotiable.

### 1. Plugins are optional, not required

Nx works with any technology out of the box. Plugins simplify setup and maintenance (generators, executors, inferred tasks, version management) but the underlying tool still works without them.

**Rule:** Every opening paragraph must communicate what the plugin adds without implying it's required. The framing is "Nx works already; the plugin makes it better" — never "you need the plugin to use X with Nx."
**Callouts:** Some plugins may need extra nuance (for example the TypeScript plugin and compiler choice). When that's true, include a short callout in the opening or Configuration section, but keep the optional framing consistent.

### 2. "Add to existing" is the primary use case

Most users arrive at a hub page because they already have a workspace and want to add or configure a tool. "Create a new workspace from scratch" is secondary.

**Rule:** The "add to existing workspace" path always comes before "create new workspace" in the Setup section. Never lead with `create-nx-workspace`.
**Rule:** For build/test tools, make the "add to an existing project" step explicit. These tools are a means to an end; if the user wants a new framework app with the tool, link to the framework hub page instead.

### 3. Optimize for both humans and AI agents

Following the AX principles from DOC-405: descriptive headings, short paragraphs, linked features, copy-pasteable commands, verification steps.

**Rules:**

- All commands must be copy-pasteable (no pseudo-code in shell blocks)
- Every installation step has a verification step ("how do I know it worked?")
- No critical information locked behind videos or screenshots
- Headings must be descriptive enough to be useful in search results and AI retrieval (not "Overview" or "Usage" — instead "Build TypeScript Libraries" or "Run Unit Tests")

### 4. Progressive disclosure mirrors Getting Started

Technology pages follow the same stage model as the Getting Started pages, adapted for a user who already has Nx:

| Stage              | Content                                                         | Depth                                     |
| ------------------ | --------------------------------------------------------------- | ----------------------------------------- |
| **Setup**          | Install plugin, verify, configure existing projects             | Thorough — every step explicit            |
| **Daily Workflow** | Generate, build, test, lint — the common tasks                  | Thorough — this is where users spend time |
| **Configuration**  | Inference from existing config, plugin options, exclude/include | Thorough — daily-driver reference content |
| **CI**             | Affected, caching, tool-specific optimizations                  | Enough to get started, link for advanced  |
| **Advanced**       | Custom executors, deployment, edge cases                        | Link only — lives in Knowledge Base       |

### 5. Consistent flow, flexible headings

All pages follow the same information architecture, but headings adapt to the technology. A reader who's seen one hub page knows what to expect from another.

**Rule:** The section order is fixed (Opening → Setup → Daily Workflow → Configuration → CI Considerations → What's Next). The exact heading text adapts to the technology — "Running Tests" for Jest, "Generate and Manage Libraries" for TypeScript — but the position in the page does not change.

---

## User Personas

### Human Developer

- Lands on the page from search, sidebar navigation, or a link from another doc page
- Scans headings first, reads sections relevant to their task
- Wants copy-pasteable commands and clear "what to do next"
- May be evaluating Nx or already using it
- **Returns to this page** for configuration and task reference

### AI Agent (Claude Code, Copilot, Cursor, etc.)

- Fetches the page via MCP, RAG, or direct URL
- Needs unambiguous, factual content to generate accurate answers
- Follows links to get deeper context
- Benefits from: explicit prerequisites, exact commands, verification steps, success criteria
- **Cannot watch videos or interpret screenshots** — all critical info must be in text

---

## Technology Categories

Each technology falls into a category. The category shapes which user journeys are relevant and how deep each section goes. Use this table to determine your page's emphasis.

| Category                 | Examples                          | Primary User Intent                            | Content Emphasis                                                         |
| ------------------------ | --------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| **Framework**            | React, Angular, Vue, Node         | "Build apps and libraries with this framework" | Generators, daily workflow, build/serve/test                             |
| **Build Tool**           | Vite, Webpack, Rollup, esbuild    | "Use this bundler for my projects"             | Conversion from other bundlers, framework examples that link out         |
| **Test Tool**            | Jest, Vitest, Cypress, Playwright | "Set up testing for my projects"               | Add-to-existing, running tests, coverage, CI splitting                   |
| **Quality Tool**         | ESLint                            | "Set up linting/quality checks"                | Add-to-existing, rule configuration, module boundaries                   |
| **Non-JS Ecosystem**     | Java (Gradle/Maven), .NET         | "Use Nx with my non-JS codebase"               | Prerequisites, `nx init` flow, value of Nx on top of existing build tool |
| **Architecture Pattern** | Module Federation                 | "Implement this architecture pattern"          | When/why to use it, setup with specific frameworks                       |
| **Language/Platform**    | TypeScript                        | "Manage TS/JS projects and monorepo setup"     | Workspace presets, project references, library management                |

**Key insight for build tools:** Users don't arrive wanting "Vite" in isolation — they want "Vite for my React project" or "switch from Webpack to Vite." Build tool pages should show minimal framework examples with required args, then link to the framework page for the full workflow.

**Key insight for build/test tools:** These tools are a means to an end. Emphasize adding them to an existing project or converting from another tool, and point to the framework hub page when the user’s real goal is a new app.

**Key insight for non-JS ecosystems:** The setup flow is fundamentally different. These users start with `nx init` in an existing project, not `nx add` in an existing Nx workspace. The value proposition section replaces some of what the opening paragraph does for JS plugins.

---

## User Journeys

### Universal Journeys (every hub page must address)

| #   | Journey                    | Question the user is asking                                | Maps to section |
| --- | -------------------------- | ---------------------------------------------------------- | --------------- |
| 1   | Understand                 | "What is this plugin and what does it give me?"            | Opening         |
| 2   | Requirements               | "What versions/tools do I need?"                           | Opening / Setup |
| 3   | Add to workspace           | "How do I add this to my existing Nx workspace?"           | Setup           |
| 4   | Configure existing project | "I have a project already — how do I add this tool to it?" | Setup           |
| 5   | Create new                 | "How do I start a new project with this?"                  | Setup           |
| 6   | Daily workflow             | "What are the common tasks I'll run?"                      | Daily Workflow  |
| 7   | Configure inference        | "How does the plugin work with my existing config files?"  | Configuration   |
| 8   | Exclude/include            | "How do I opt specific projects in or out?"                | Configuration   |
| 9   | Run in CI                  | "What's specific to this tool in CI?"                      | CI              |
| 10  | Go deeper                  | "Where do I go for specific recipes and reference?"        | What's Next     |

### Problems These Pages Must Answer

Each hub page should make it easy to answer the following without searching elsewhere:

1. What does this plugin give me beyond core Nx, and what are the requirements?
2. How do I add it to an existing Nx workspace and verify it worked?
3. I already have a project — how do I configure it to use this tool?
4. How do I start a new project with this technology (if applicable)?
5. What are the daily commands I will run?
6. I already have config files (tsconfig, jest.config, etc.) — how does the plugin use them?
7. How do I customize what the plugin does (plugin options, target names)?
8. How do I exclude or include specific projects?
9. What tool-specific CI optimizations should I know about (batch mode, atomizer, worker limits)?
10. Where do I go next for advanced workflows and references?

### Category-Specific Journeys

Beyond the universal journeys, each category has additional questions. Writers should check this list to ensure they don't miss category-relevant content.

**Frameworks** additionally cover: generating apps, generating libraries, scaffolding components/hooks/services, build + serve for dev, choosing/configuring a bundler, migration from framework CLI.

**Build Tools** additionally cover: converting an existing project to this bundler, which frameworks it works with, customizing build configuration, what tasks the plugin infers automatically, and when to link to the framework hub page for a new app.

**Test Tools** additionally cover: adding the tool to an existing project, running tests in all modes (basic, watch, specific file), code coverage, configuration customization, CI optimization (batch mode, worker limits), E2E test splitting.

**Non-JS Ecosystems** additionally cover: prerequisite tooling, adding Nx via `nx init`, the value proposition of Nx on top of existing build tooling, choosing between plugin variants (Gradle vs Maven), running existing tasks through Nx.

**Quality Tools** additionally cover: adding linting to a workspace, running linting, configuring rules, enforcing module boundaries.

---

## Writing Guidelines

### Voice and Tone

- **Direct and factual.** State what things do, not what they can do. "The plugin infers a `build` task" not "the plugin can infer a `build` task."
- **Second person.** Address the reader as "you."
- **No sales language.** Avoid superlatives ("blazing fast", "incredibly powerful"). State the benefit factually: "SWC compiles faster than TSC" or "Affected commands skip unchanged projects."
- **Short paragraphs.** 3-5 lines maximum. If a paragraph needs more, break it into a list or multiple paragraphs.

### Headings

- **Descriptive, not generic.** "Build TypeScript Libraries" not "Build." "Run Unit Tests" not "Test." Headings should make sense when read in isolation (search results, AI retrieval, table of contents).
- **Action-oriented where possible.** Prefer "Generate and Manage Libraries" over "Library Management."
- **No heading should duplicate the page title.** If the page is "TypeScript Plugin for Nx," don't have a heading "Using TypeScript with Nx" — be more specific about what that section covers.

### Commands

- **Every shell command must be copy-pasteable.** No pseudo-code, no `[placeholders]` in shell blocks. Use concrete example names (`my-lib`, `my-app`) and add a note: "Replace `my-lib` with your project name."
- **Show the most common invocation first.** If there are multiple ways to run a task, lead with the one most users will use.
- **Include all required arguments.** Generators often have required args that aren't obvious. Always show them.

### Linking

- **Link to in-page sections from the opening paragraph.** The opening should reference the page's own sections, keeping users on the page rather than sending them elsewhere immediately.
- **Every Nx feature mentioned must link to its page.** If you say "caching," link to the caching docs. If you say "project graph," link to the graph docs.
- **Prefer internal docs links for deeper coverage.** When referencing features or options that are explained elsewhere, link to the relevant Nx docs first. Link to external technology docs only when the Nx docs do not cover the topic.
- **Link to external tools once, at first mention.** Link to the Jest docs once in the opening, not on every reference.
- **Cross-link related technologies.** If the test section mentions Jest and Vitest as options, link both hub pages.
- **Link out from subsections, not from the opening.** Detailed reference links (generator lists, executor APIs) belong in the relevant subsection, not in the first paragraph.

### Code Blocks

- **Show real configuration, not schemas.** Users copy code blocks. Show actual `nx.json` with real values, not JSON schema definitions.
- **Use comments to mark file paths.** Start JSON blocks with `// nx.json` or `// packages/my-lib/tsconfig.lib.json` so users know where the file lives.
- **Use `{% meta="{line-range}" %}` for highlighting.** When a code block shows a file and the relevant change is a few specific lines, highlight those lines.
- **Explain the "why" outside the code block.** The paragraph before or after should say what the code does and why the user would want it. Don't rely on code comments for explanation.

### Content Depth by Category

Not every section carries the same weight on every page. Use this matrix to calibrate how much to write:

| Section               | Framework                   | Build Tool                           | Test Tool                                 | Non-JS                         | Quality                  |
| --------------------- | --------------------------- | ------------------------------------ | ----------------------------------------- | ------------------------------ | ------------------------ |
| **Opening**           | Medium                      | Medium                               | Medium                                    | Long (value prop)              | Medium                   |
| **Setup**             | Medium                      | Medium (+ config generator)          | Medium (+ config generator)               | Long (prerequisites + nx init) | Medium                   |
| **Daily Workflow**    | Long (generators + tasks)   | Medium (inferred tasks + conversion) | Long (all test modes)                     | Medium (task mapping)          | Medium                   |
| **Configuration**     | Medium                      | Medium                               | Long (dual config, include/exclude)       | Medium (target customization)  | Long (rules, boundaries) |
| **CI Considerations** | Medium (affected + caching) | Short (caching + link)               | Long (performance + splitting + atomizer) | Long (value proposition)       | Short                    |
| **What's Next**       | 4-6 cards                   | 4 cards                              | 4-6 cards                                 | 4 cards                        | 3-4 cards                |

**"Long"** = thorough coverage with multiple subsections, code examples, and explanation.
**"Medium"** = cover the topic with one or two focused examples and brief explanation.
**"Short"** = one paragraph and a command or link. Enough to get started, then hand off.

---

## Page Template

All hub pages follow this section flow. Every section is required unless marked optional.

### Flow Overview

```
1. Opening              — What it is, requirements, plugin features (with section links)
2. Setup                — Add plugin, verify, create new, configure existing project
3. Daily Workflow       — Generate, build, test, lint — the common tasks
4. Configuration        — Inference from existing config, plugin options, exclude/include
5. CI Considerations    — Affected, caching, tool-specific optimizations
6. What's Next          — Tutorials, recipes, reference
```

### Topics Every Plugin Page Must Address

These are the core questions every hub page answers. They map to sections but aren't 1:1 — a topic may be a subsection, a paragraph, or a callout depending on the plugin.

| Topic                              | Question                                                                | Where it lives                                                 |
| ---------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Requirements**                   | "What versions/tools do I need?"                                        | Opening or Setup (callout if brief, subsection if substantial) |
| **Features / Why**                 | "What does this plugin give me beyond core Nx?"                         | Opening — feature list with links to in-page sections          |
| **Add and configure the plugin**   | "How do I install it and verify it works?"                              | Setup                                                          |
| **Configure for existing project** | "I already have a project — how do I add this tool to it?"              | Setup (subsection after plugin install)                        |
| **How existing config files work** | "I already have a tsconfig / jest.config / vite.config — what happens?" | Configuration — inference explanation                          |
| **Plugin options**                 | "How do I customize what the plugin does?"                              | Configuration — `nx.json` plugin options                       |
| **Exclude/include projects**       | "How do I opt specific projects in or out?"                             | Configuration — explicit subsection                            |
| **CI considerations**              | "What's specific to this tool in CI?"                                   | CI Considerations                                              |

---

### Section 1: Opening

**Purpose:** Tell the reader what this technology is, why they'd use the Nx plugin, and what it provides. Doubles as a mini table-of-contents by linking to in-page sections.

**Rules:**

1. First sentence: what the plugin is and what it provides. Name specific capabilities (generators, inferred tasks, sync generators) and link to the in-page sections that cover them.
2. Second sentence: clarify the plugin is optional. Nx features like caching, graph, and task orchestration work without the plugin. The plugin simplifies setup and maintenance.
3. **Requirements (if applicable):** If the plugin has version constraints (e.g., "requires TypeScript 5.0+", "requires Vitest 2.x+"), state them here or as a callout in Setup. Only include when the constraint is non-obvious — don't state that a TypeScript plugin needs TypeScript installed.
4. **Feature preview:** List the key things the plugin provides, linking each to the relevant section on the page. This is the "why you'd want to add this plugin" pitch. Keep it factual — name the features, don't sell them. Examples: sync generators (project references), atomizer, task inference, caching integration, configuration generators.

**Anti-patterns to avoid:**

- Defining the technology for people who already know it ("TypeScript is a typed superset of JavaScript")
- Linking to external reference pages in the opening (generators list, API docs) — link to in-page sections instead
- Using vague language ("powerful tooling", "seamless integration")
- Listing features without linking to where they're explained on the page

---

### Section 2: Setup

**Purpose:** Get the plugin installed, verified, and configured for existing projects.

This section answers three distinct questions in order:

1. "How do I add the plugin to my workspace?" (plugin installation)
2. "How do I start a new project from scratch?" (create new — secondary)
3. "How do I add this tool to a project that already exists?" (configuration generators)

**Rules:**

1. **"Add to existing workspace" always comes first.** `nx add @nx/[plugin]`.
2. **Always include the version sync aside** (identical wording across all pages).
3. **Always include a verification step** after installation. Use concrete, copy-pasteable commands that show the plugin is working (e.g., `nx report`, `nx show projects --with-target=build`, `nx show project <name>`). Describe what the user should expect to see.
4. **"Create new" comes second.** Adapt to category: `create-nx-workspace` for frameworks/languages, `nx g` for test/build tools, `nx init` for non-JS ecosystems.
5. **If a tutorial exists,** call it out with a `{% aside type="tip" %}` after the create-new subsection.
6. **"Configure for existing project" is a distinct subsection.** This is where configuration generators live — `nx g @nx/jest:configuration --project=my-app`, `nx g @nx/js:setup-build`, `nx g @nx/vite:configuration --project=my-app`. This is NOT the same as installing the plugin. Installing adds the plugin to the workspace; configuration generators set up individual projects to use the tool.

**Category adaptations:**

- **Test/Build tools:** The "configure for existing project" subsection is especially important. These plugins are often added to projects that already exist but don't have the tool configured yet.
- **Build tools:** Show minimal framework-specific examples in tabs, then link to the framework hub page. If the user's goal is a new app, the framework hub page is the primary path.
- **Non-JS ecosystems:** Lead with prerequisites (runtime versions, build tool requirements) and use `nx init` instead of `nx add`.
- **Consistency note:** Configuration generators should follow a consistent naming pattern across plugins. If a plugin uses a non-obvious name (e.g., `setup-build` instead of `configuration`), call it out explicitly.

---

### Section 3: Daily Workflow

**Purpose:** The tasks a developer runs regularly. This is the section users return to most frequently.

**Rules:**

1. Cover every task most users will run daily. For a framework, that's generate/serve/build/test/lint. For a test tool, that's run/watch/coverage/specific-file.
2. Every command gets a brief explanation of what it does, not just the command itself.
3. When the section shows build output, explain where it goes and how it's controlled (e.g., `outDir` in tsconfig). Note the relationship to Nx caching — if the plugin reads output paths automatically, say so. If the user needs to keep target outputs in sync manually, explain that.
4. If the plugin has generators for scaffolding code (components, hooks, services), show the most common ones.
5. When a task can be added after initial generation (e.g., adding a build target via a generator), mention the relevant configuration generator and link back to Setup.

**Category adaptations:**

- **Frameworks** emphasize code generation (generators for apps, libraries, components) and the serve/build/test cycle.
- **Build tools** emphasize inferred tasks (what you get automatically) and conversion from other tools.
- **Test tools** cover all running modes: basic, watch, specific file, coverage. Include brief code examples where helpful (snapshot testing).
- **Non-JS ecosystems** show how existing build system tasks map to `nx` commands and emphasize `nx graph` and `nx affected` as new capabilities.

---

### Section 4: Configuration

**Purpose:** How the plugin reads existing configuration, how to customize its behavior, and how to control which projects it applies to. This is daily-driver reference content.

This section answers three distinct questions:

1. "How does the plugin work with my existing config files?" (inference)
2. "How do I customize what the plugin does?" (plugin options)
3. "How do I include or exclude specific projects?" (scoping)

**Rules:**

1. **Explain how inference works with existing config files.** State what config files the plugin looks for (e.g., `tsconfig.json`, `jest.config.ts`, `vite.config.ts`) and what tasks it creates from them. If inference has conditions (e.g., "only adds a `build` task if `package.json` exports point to compiled output"), explain those conditions with positive and negative examples.
2. **Show the `nx.json` plugin options block.** This is the code block users will copy. Use real default values.
3. **Present options in a table** with columns: Option, Description, Default. Verify options against the plugin source code — don't guess.
4. **Explain how to exclude/include projects.** This is a first-class subsection, not an afterthought. Cover:
   - Plugin-level: `include`/`exclude` patterns in the `nx.json` plugins array
   - Task-level: setting a task to `false` in plugin options to disable it workspace-wide
   - Project-level: per-project opt-out flags (e.g., `nx.addTypecheckTarget: false` in tsconfig)
5. **Show how to view inferred tasks** — `nx show project <name>` and Nx Console.
6. **Link to the full generator/executor reference** for exhaustive option lists, rather than reproducing them here.
7. **Include plugin-specific "what to know" callouts** that are common across users (for example: buildable vs publishable libs, convert-to-swc generator, or when to use project references). Keep these to the 80% case.

**Category adaptations:**

- **Test tools** may need dual-plugin configuration (unit tests vs E2E tests with separate `include`/`exclude` patterns). Show this as a subsection — this is a common pattern that trips people up.
- **Non-JS ecosystems** focus on target customization: renaming, disabling, adding `dependsOn`.
- **Framework pages** are lighter here — focus on bundler/test runner defaults and how to change them.

---

### Section 5: CI Considerations

**Purpose:** Tool-specific CI optimizations and configuration. Every technology has at least one CI-relevant consideration.

**Rules:**

1. Always mention `nx affected` — this is the universal CI optimization.
2. Always mention remote caching with `nx connect`.
3. Always link to the CI setup guide for complete configuration.
4. **Include tool-specific CI optimizations** as concrete subsections. Examples: TSC batch mode, Jest `--runInBand`, Vitest worker limits, test splitting via `ciTargetName`, atomizer configuration. These are the things that prevent flakiness or meaningfully improve CI performance for this specific tool.
5. If the technology supports test splitting or atomization, explain the configuration (`ciTargetName`, atomizer setup) and link to the deep-dive guide.

**Category adaptations:**

- **Test tools** have the longest CI section: performance tuning, parallel execution, E2E test splitting with `ciTargetName`, atomizer.
- **Non-JS ecosystems** use this section as a value proposition — explain what Nx adds on top of the existing build tool's CI story (caching, affected, distributed execution, graph).
- **Build tools** keep this short — the CI story is more about the framework than the bundler. One paragraph on caching + affected is sufficient.

---

### Section 6: What's Next

**Purpose:** Guided navigation to content beyond daily-driving — specific workflows, tutorials, migration guides, reference docs.

**Rules:**

1. Use `{% cardgrid %}` with `{% linkcard %}` — not a flat bullet list.
2. Maximum 6 cards.
3. Every card has a `title`, `description`, and `href`. Descriptions are one sentence explaining what the user will learn.
4. Always include links to the generators and executors reference pages when they exist for that technology.
5. Always include a migration guide link when one exists for that technology.
6. Prioritize: tutorial first (if one exists), then common workflows/recipes, then migration guide (if applicable), then generators/executors reference last.
7. These cards point to the Knowledge Base content that doesn't belong on the hub page — the specific scenarios, the "long tail" of workflows.

---

## AX Checklist

Apply to every technology hub page before considering it complete.

### Structure & Flow

- [ ] Follows the section order: Opening → Setup → Daily Workflow → Configuration → CI → What's Next
- [ ] Opening previews plugin features with links to in-page sections
- [ ] "Add to existing" comes before "Create new" in Setup
- [ ] Short paragraphs (3-5 lines max)
- [ ] Descriptive headings (not "Overview", "Usage", or bare tool names)

### Opening & Plugin Framing

- [ ] Does NOT imply the plugin is required to use the technology with Nx
- [ ] Clearly states what the plugin adds (generators, sync generators, inferred tasks, etc.)
- [ ] Mentions that Nx features like caching and graph work without the plugin
- [ ] Lists requirements/version constraints (if applicable)
- [ ] Feature list links to in-page sections where each is explained

### Setup

- [ ] Verification step after plugin installation (concrete commands + expected output)
- [ ] "Configure for existing project" subsection with configuration generator (if applicable)
- [ ] Configuration generator includes all required args

### Commands & Actions

- [ ] All commands are copy-pasteable (no pseudo-code in shell blocks)
- [ ] Generator examples include all required args
- [ ] Build output location explained with relationship to Nx caching outputs

### Configuration

- [ ] Explains which existing config files trigger task inference
- [ ] Shows the `nx.json` plugin options block with real values
- [ ] Plugin options verified against source code
- [ ] Options presented in a table (Option, Description, Default)
- [ ] **Exclude/include covered:** plugin-level (`include`/`exclude`), task-level (set to `false`), project-level (opt-out flags)
- [ ] Shows how to view inferred tasks (`nx show project`)

### CI Considerations

- [ ] Mentions `nx affected`
- [ ] Mentions remote caching
- [ ] Links to CI setup guide
- [ ] Tool-specific CI optimizations documented (batch mode, worker limits, atomizer, etc.)
- [ ] Test tools: mentions E2E test splitting / atomizer with `ciTargetName`
- [ ] Non-JS: explicitly states value Nx adds on top of existing build tool

### Navigation & Links

- [ ] Opening links to in-page sections, not external reference pages
- [ ] Every Nx feature mentioned links to its dedicated page
- [ ] "What's Next" uses card grid with max 6 cards
- [ ] Always includes generators/executors/migrations reference links
- [ ] Related technologies are cross-linked
- [ ] Links to tutorial (if one exists)

### AI-Specific

- [ ] No critical information locked in videos or images
- [ ] Factual accuracy — no outdated commands or deprecated options
- [ ] Unambiguous: when multiple options exist, state a recommendation

---

## Migration Strategy

### Process for each existing introduction.mdoc

1. **Audit** — Compare against the section rules and AX checklist. Note what's missing, what's misplaced, what belongs on a subpage.
2. **Relocate** — Move specific recipes and edge case configs to Knowledge Base subpages. Don't delete content — move it.
3. **Restructure** — Rewrite following the section order and rules. Use the Content Depth matrix to calibrate how much to write per section.
4. **Add missing content** — Verification steps, AI prompt, Configuration section, CI section, plugin-optional framing.
5. **Verify options** — Check all plugin options against the plugin source code (`packages/[plugin]/src/plugins/`).
6. **Review** — Check against AX checklist.
7. **Test** — Manual verification with AI assistant: ask common questions, verify the page produces accurate responses.

### Priority Order

Based on traffic and user impact:

1. **React** — Highest traffic framework page
2. **Angular** — Large existing user base, migration from Angular CLI is major journey
3. **TypeScript** — Foundation for most JS/TS workspaces
4. **Jest / Vitest** — Most common "add to existing" use case
5. **Vite** — Most popular modern bundler
6. **Java** — Growing non-JS ecosystem
7. **Node** — Common backend use case
8. **Vue** — Currently very thin
9. **ESLint** — Quality tooling
10. **.NET** — Experimental, lower priority
11. **Remaining build tools** (Webpack, Rollup, esbuild, Rspack, Rsbuild)
12. **Remaining test tools** (Cypress, Playwright, Storybook, Detox)
13. **Module Federation** — Architecture pattern, different audience

---

## Reference Implementation

The TypeScript hub page (`astro-docs/src/content/docs/technologies/typescript/introduction.mdoc`) is the first page rewritten to follow this spec. Use it as a reference for how the principles translate to actual content, but follow the rules in this spec — not the patterns in the reference page — when they diverge.
