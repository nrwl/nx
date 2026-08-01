# Nx Documentation Style Guide

These rules apply to all content under `astro-docs/src/content/docs/`.
[Vale](#vale-configuration) enforces the mechanical ones automatically.

## Information architecture

When creating or reorganizing documentation, follow these five principles to determine where content belongs.

### 1. Progressive disclosure (the "journey" rule)

Don't overwhelm the user. Reveal complexity only as they advance in their journey.

**The test:** Is this for the first 30 minutes (Getting Started), the first 30 days (Features), or forever (Reference)?

### 2. Category homogeneity (the "scan" rule)

Items in a list must be of the same "type" (noun, verb, or concept) to reduce cognitive load.

**The test:** Does this list mix concepts (mental model), tasks (update Nx), and products (React)? If yes, split it.

### 3. Type-based navigation (the "intent" rule)

Separate learning (narrative/guides) from looking up (reference/API).

**The test:** Is the user here to learn a workflow (guide) or look up a flag syntax (reference)?

### 4. The pen and paper test (the "theory" rule)

Distinguish architecture from features to keep "core concepts" pure.

**The test:** Can I explain this using only a pen and paper?

- Yes: It goes in **How Nx Works** (architecture).
- No (I need a terminal): It goes in **Platform Features** (feature).

### 5. Universal vs. specific (the "placement" rule)

Distinguish platform features from ecosystem tools to prevent "Features" from becoming a junk drawer.

**The test:** Does this feature apply to every user (e.g., caching, Nx Agents)?

- Yes: **Platform Features**.
- No (only React users): **Technologies**.

### 6. The golden path (the "one way" rule)

Feature pages teach the default workflow. Limit flags and variants to the ones a reader needs
to make a decision.

**The test:** Would a first-time user need this sentence to succeed or to choose? If not, it
belongs in the corresponding Knowledge Base guide.

- Show one command form. If `nx migrate` works without arguments, don't also show `nx migrate latest`.
- When a flag presents a real choice, explain it briefly on the feature page (for example, why
  pick `--include=required` over `all`) and link the Knowledge Base guide for constraints and
  edge cases.
- Remove deprecated options entirely when a replacement exists - no deprecation asides. The same
  applies to workflows a new flag has superseded.
- When two sections converge on the same flag or topic after a rewrite, merge them into one.

### Sidebar structure

The sidebar has four top-level sections that follow the user journey:

1. **Getting Started** - Essential setup, tutorials, and core concepts (How Nx Works, Platform Features)
2. **Technologies** - Framework and tool-specific guides (React, Angular, Node, build tools, test tools)
3. **Knowledge Base** - Recipes, troubleshooting, and topic-specific guides
4. **Reference** - Exhaustive facts, no narrative (CLI commands, configuration, API docs)

## Structural anti-AI rules (longform)

Sentence-level edits don't fix AI voice in longform pieces. The structural tells matter more.

### One canonical home per point

Each substantive point lives in exactly one section. Other sections link or reference it in one phrase. They don't re-explain.

### No drama-beat echoes

A short sentence (under ~10 words) immediately after a long one, restating the long one for emphasis, is an AI tic.
Cover the short sentence with your thumb. If nothing is lost, cut it.

### No restatement closers

Read the last sentence of each paragraph alone.
If it summarizes what the paragraph said rather than adding a fact, judgment, or turn, cut it.

### Match claims to evidence

Every quantifier ("always", "never", "all", "completely", "fully", "rarely") and every counterfactual ("would have prevented", "would have caught") should be checked against the evidence actually in the doc.

Two failure modes:

- **Over-generalization**: one observed instance written as a broad pattern. If the doc has one data point, don't write "users frequently" or "this always happens."
- **Under-calibration**: softening a true absolute, or absolutizing a partial fix. "Would have prevented" is fine when the fix categorically closes the outcome. It's wrong when the fix closes one path of several.

Ask of each strong claim: "what in this doc supports the strength of this word?" If nothing, weaken or cite.

### Vary sentence rhythm

Uniform, medium-length sentences in a confident register are the strongest
statistical AI signature. Human writing is bursty: short fragments next to
long chains.

**The test:** Read a paragraph aloud. If every sentence takes the same
breath, split one and merge two others.

### Ration colon-expansion sentences

"Claim: elaboration, elaboration, elaboration" is fine once per section.
Repeated, it's a fingerprint.

**The test:** Grep for mid-sentence colons. More than one or two per screen
of prose, rewrite the extras as plain sentences.

### Vary bullet structure

A bolded lead-in label is fine, and often the clearest way to write a short
reference list. What reads as AI is a run of bullets in lockstep: same
opening grammar, same claim-then-elaborate shape, same length, every time.

**The test:** In longform prose, if three or more adjacent bullets march in
lockstep, break the pattern. Vary the lengths, drop the label from one, or
fold a bullet into the surrounding paragraph.

### Ration balanced-contrast constructions

"Neither X nor Y", "not just X but Y", "X, not Y" are rhetorically tidy and
AI drafts overuse them.

**The test:** One per section. If a paragraph contains two, keep the one
that carries a real distinction and flatten the other into a plain claim.

### Pre-publish pass order

Run passes in this order. Structural first, vocabulary last.

1. Canonical-home audit: where does each substantive point live?
2. Repetition count: grep your two or three core findings. If a finding appears more than twice in prose, the third is probably redundant.
3. Drama-beat sweep.
4. Closer pass.
5. Claim audit: for each absolute and each counterfactual, check what evidence in the doc supports that strength. Weaken or cite.
6. End-to-end consistency read.
7. Vocabulary grep (cheapest, lowest value).

## The Nx voice

Nx documentation is **direct, practical, and confident**. We write like a knowledgeable colleague pairing with you, not like a textbook, not like a marketing page, and not like a chatbot.

The voice should be:

- **Conversational but efficient.** Use contractions. Get to the point. Don't pad sentences.
- **Second person.** Write "you". Address the reader directly.
- **Action-oriented.** Lead with what the reader can _do_, not what Nx _is_.
- **Honest about tradeoffs.** Don't oversell. If something has limitations, say so.

### Voice do's and don'ts

| Do                                                                       | Don't                                                                                               |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| "You can speed up builds by enabling remote caching."                    | "Nx allows you to speed up builds."                                                                 |
| "Run `nx build` to build your project."                                  | "In order to build your project, you can run the `nx build` command."                               |
| "This works best with fewer than 50 projects."                           | "This feature can easily scale to any number of projects."                                          |
| "Nx reads your `vite.config.ts` and infers build targets automatically." | "Nx provides a robust and comprehensive mechanism for inferring build targets."                     |
| "If the cache is stale, delete `.nx/cache` and retry."                   | "Should you encounter issues with caching, you may want to consider clearing your cache directory." |

### Anti-AI language

Edit AI-assisted drafts so they don't read like AI wrote them. Phrase-level passes alone won't do it. Apply the structural rules above first.

**Never use these phrases:**

- "It's important to note that..."
- "It's worth noting that..." / "It should be noted that..."
- "In this section, we will explore..."
- "Let's dive into..." / "Let's take a closer look at..."
- "Delve into..." / "Delving into..."
- "Embark on a journey..." / "Embark on..."
- "Navigate the realm of..." / "In the realm of..." / "In the world of..."
- "At its core..."
- "A testament to..."
- "Rich tapestry" / "Tapestry of..."
- "Plays a vital/crucial/pivotal/key role"
- "Whether you're a beginner or an experienced developer..."
- "In today's fast-paced development environment..."
- "Unlock the power of..." / "Harness the power of..."
- "Take your workspace to the next level"
- "Streamline your workflow" (as a generic claim without specifics)
- "This comprehensive guide will..."
- "Without further ado..."
- "In conclusion..." / "To summarize..." / "As we've seen..."
- "Game-changer" / "Cutting-edge" / "Groundbreaking"
- "Seamless" / "Seamlessly" (unless describing an actual integration)

**Avoid hedging words:**

- "Essentially" / "Basically" / "Effectively"
- "Generally speaking"
- "It is worth mentioning"
- "Arguably"
- "Needless to say"
- "As a matter of fact"

**Watch for AI-style sentence patterns:**

- Sentences that start with "This allows you to..." or "This enables you to...". Rewrite to lead with the reader's action.
- Paragraphs that start with a general claim and then restate it slightly differently. Say it once.
- Excessive use of "robust", "leverage", "utilize", "facilitate", "comprehensive", "aforementioned."
- TED-talk verbs: "delve", "underscore" (as verb), "foster", "empower", "embark", "unlock", "harness". Replace with the concrete action.
- Filler adjectives: "meticulous", "crucial", "pivotal", "paramount", "intricate", "multifaceted".
- Lists where every item starts with the same grammatical structure repeated 5+ times with slight variation. Vary your phrasing.

### Self-referential writing

Don't write about the document itself.

Do:

- "Nx uses a project graph to determine task dependencies."

Don't:

- "This page explains how Nx uses a project graph."
- "In this guide, we'll walk through..."
- "This document covers..."

Get right to the point. The reader already knows they're on a page.

### Building trust

Don't use filler words that undermine the reader's trust.

- Don't use "easily", "simply", "just", or "straightforward". If something were truly simple, you wouldn't need to document it. These words also make readers feel bad when they struggle.
- Don't use marketing language: "This feature will save you hours" or "Nx makes CI effortless."
- Be specific instead: "Remote caching can reduce CI times from 45 minutes to under 5 minutes for cache-hit builds."

### Customer perspective

Focus on what the reader can do, not what Nx does.

Do:

- "Use `nx affected` to run tasks only for projects impacted by your changes."

Don't:

- "Nx allows you to run affected tasks."
- "Nx provides the ability to run tasks selectively."

Words like "allow" and "enable" are signals you're writing from the product's perspective instead of the reader's.

## Language

Write in US English.

### Active voice

Use active voice in most cases.

Do: "Nx caches the build output."
Don't: "The build output is cached by Nx."

Exception: When "Nx" as the subject sounds awkward, passive voice is fine. "The output is stored in `.nx/cache`" is better than "Nx stores the output in `.nx/cache`" if Nx isn't the focus of the sentence.

### Contractions

Use contractions. They make the text feel natural.

- "You'll need to configure..." not "You will need to configure..."
- "It doesn't support..." not "It does not support..."

Don't contract for emphasis in warnings or error descriptions:

- "**Do not** delete the `nx.json` file."
- "Requests to localhost **are not** allowed."

Don't contract proper nouns: "the Vite plugin is..." not "Vite's a plugin..."

### Capitalization

Use sentence case for headings. Capitalize proper nouns only.

- `# Use remote caching to speed up CI`
- `## Configure the Vite plugin`

Feature names are lowercase unless they are a proper product name:

| Correct        | Incorrect      |
| -------------- | -------------- |
| remote caching | Remote Caching |
| project graph  | Project Graph  |
| Nx Cloud       | nx cloud       |
| Nx Console     | nx console     |
| Nx Agents      | nx agents      |
| Nx Replay      | nx replay      |

### Acronyms

Spell out acronyms on first use per page. Don't spell out widely-known ones: CI, CD, API, URL, CLI, PR, IDE.

Don't make acronyms plural with apostrophes. Use `APIs`, not `API's`.

### Numbers

Spell out zero through nine. Use numerals for 10 and above. Always use numerals with units: "5 minutes", "3 projects."

### Possessives

Don't use possessives on product names. "the Docker CLI", not "Docker's CLI." "the Nx configuration", not "Nx's configuration."

## Text

### Headings

- Don't skip heading levels (e.g., `##` to `####`).
- Don't use code in headings unless it's essential (like a CLI command).
- Don't use bold text in headings.
- Keep headings short and scannable. Lead with keywords.

### Line length

- Wrap lines at approximately 100 characters for readability in diffs.
- Start each new sentence on a new line.
- Exception: Don't break links across lines.

### Punctuation

- Use serial (Oxford) commas: "React, Angular, and Vue."
- Use one space between sentences.
- Don't use semicolons. Use two sentences instead.
- Don't use em dashes or en dashes. Use commas or separate sentences.

### Placeholder text

Use `<` and `>` for values the reader must replace:

```shell
nx run <project-name>:build
```

If the placeholder is inline, wrap it in a single backtick: `<your-project>`.

### Bold

Use bold for:

- UI elements: "Select **Add Connection**."
- Navigation paths: "Go to **Settings** > **Workspace**."

Don't use bold for emphasis or keywords. If you need emphasis, rewrite the sentence to be clearer.

### Inline code

Use inline code (single backticks) for:

- Commands and CLI arguments: `nx build`, `--parallel`
- File names and paths: `nx.json`, `.nx/cache`
- Configuration keys: `targetDefaults`, `namedInputs`
- Short outputs and values: `true`, `false`, `success`

### Code blocks

Use triple backticks with a language identifier:

````markdown
```json
{
  "targetDefaults": {
    "build": {
      "cache": true
    }
  }
}
```
````

- Always specify a syntax language. Use `plaintext` if nothing else fits.
- Add a blank line before and after code blocks.
- For long config files, show only the relevant section and use comments to indicate omitted parts:

```json
{
  // ... other config
  "targetDefaults": {
    "build": {
      "cache": true
    }
  }
}
```

## Links

Links help readers find related information, but too many links make text hard to read.

### General rules

- Don't duplicate links. If you link to a page once, don't link to it again on the same page.
- Don't use links in headings.
- Avoid more than 15 links to other pages on any single page.
- Avoid multiple links in a single paragraph when possible.

### Link text

Use descriptive text, not "here" or "this page."

Do:

- "For more information, see [remote caching](/features/cache)."
- "To configure task pipelines, see [task pipeline configuration](/concepts/task-pipeline-configuration)."

Don't:

- "For more information, see [this page](/features/cache)."
- "Click [here](/features/cache) to learn more."
- "For more information, see the [Remote Caching](/features/cache) documentation."

Standard patterns:

- `For more information, see [link text](url).`
- `To <do this thing>, see [link text](url).`

### External links

Minimize external links. They break over time and are hard to maintain. When you must link externally, prefer official documentation (e.g., Vite docs, Webpack docs) over blog posts or third-party guides.

## Lists

- Use ordered lists for sequences of steps.
- Use unordered lists when order doesn't matter.
- Use dashes (`-`) for unordered lists.
- Start ordered list items with `1.` (Markdown auto-increments).
- Make list items parallel in structure for short reference lists
  (option names, file types, steps). For prose bullets in longform pieces,
  vary structure instead. See "Vary bullet structure."
- Add a colon after the introductory phrase.
- Don't use list items to complete an introductory sentence.

Do:

```markdown
You can clear the cache in the following ways:

- Delete the `.nx/cache` directory manually.
- Run `nx reset` to clear all cached results.
```

Don't:

```markdown
You can clear the cache by:

- Deleting the `.nx/cache` directory manually.
- Running `nx reset`.
```

## Tables

Use tables for structured data that benefits from a matrix layout. For simple lists of items with descriptions, use a regular list instead.

- Don't leave cells empty. Use "N/A" or "None."
- Use sentence case for headers.
- Keep the header and delimiter rows the same length.

## Nx-specific terminology

Use these terms consistently. When writing about Nx concepts, use the exact term from this list.

| Term           | Usage notes                                                                                |
| -------------- | ------------------------------------------------------------------------------------------ |
| workspace      | The root directory managed by Nx. Not "repo" or "monorepo" when referring to Nx's context. |
| project        | An app or library within the workspace.                                                    |
| target         | A task that can be run for a project (e.g., `build`, `test`, `lint`).                      |
| executor       | The implementation behind a target. Not "builder."                                         |
| generator      | Code scaffolding tool. Not "schematic."                                                    |
| plugin         | An Nx plugin that provides executors, generators, or graph inference.                      |
| task           | A specific invocation of a target for a project (e.g., `myapp:build`).                     |
| project graph  | The dependency graph between projects.                                                     |
| affected       | Projects impacted by a code change.                                                        |
| cache / cached | Not "memoized" or "stored results."                                                        |
| remote caching | Sharing cached results across machines. Specific product: "Nx Replay."                     |
| Nx Cloud       | The hosted CI/CD product. Always capitalized.                                              |
| Nx Console     | The IDE extension. Always capitalized.                                                     |
| Nx Agents      | Distributed task execution product. Always capitalized.                                    |
| Nx Replay      | Remote caching product. Always capitalized.                                                |
| `nx.json`      | Always in code style.                                                                      |
| `project.json` | Always in code style.                                                                      |

## Vale configuration

[Vale](https://vale.sh) enforces the mechanical rules automatically. Configuration lives in `astro-docs/`:

- `.vale.ini`: main config. Scopes rules to `src/content/docs/**/*.{mdoc,mdx,md}`.
- `.vale/styles/Nx/`: custom rules for Nx documentation.

### Running Vale

```shell
# Via Nx target (recommended)
nx vale astro-docs

# Directly (from astro-docs/ directory)
vale src/content/docs/
```

### Installing Vale

Vale is managed via [mise](https://mise.jdx.dev/). Run `mise install` from the repo root to install it.
You can also install directly via `brew install vale` (macOS) or `apt-get install vale` (Linux).

### Rule tiers

| Tier           | Severity     | Rules                                                                                                            |
| -------------- | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| 1 - Mechanical | `error`      | Banned phrases, product capitalization                                                                           |
| 2 - Structural | `warning`    | Heading case, terminology, product possessives, self-referential writing, sentence patterns, restatement closers |
| 3 - Voice      | `suggestion` | Trust-undermining words, marketing language, passive voice, serial commas                                        |

### Adding new rules

Create a new `.yml` file in `.vale/styles/Nx/`.
Vale supports several [extension points](https://vale.sh/docs/styles): `existence`, `substitution`, `occurrence`, `repetition`, `consistency`, `conditional`, `capitalization`, and `metric`.

Set `level` to match the tier: `error` for mechanical rules, `warning` for structural, `suggestion` for voice/judgment.
