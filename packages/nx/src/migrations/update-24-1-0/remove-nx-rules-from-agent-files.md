#### Remove the Nx block from agent rules files

Earlier versions of `nx configure-ai-agents` wrote a block of Nx guidelines into `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`, and kept it up to date on every run.
The command no longer writes these guidelines. Agents get the same guidance from the Nx skills and plugins it sets up.

This migration removes the block, as running `nx configure-ai-agents` does, which is everything between the `<!-- nx configuration start-->` and `<!-- nx configuration end-->` comments. Your own content in these files stays as it is.

- A file that holds nothing but the block is deleted.
- A block that only contains `@AGENTS.md` is replaced by that line when `AGENTS.md` still exists, so the file keeps importing your `AGENTS.md`.
- When `.gemini/settings.json` sets `contextFileName`, the migration also checks the files it names.

#### Sample code changes

##### Before

```md title="AGENTS.md"
# My workspace

Use pnpm for every command.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks, always prefer running the task through `nx`

<!-- nx configuration end-->
```

##### After

```md title="AGENTS.md"
# My workspace

Use pnpm for every command.
```
