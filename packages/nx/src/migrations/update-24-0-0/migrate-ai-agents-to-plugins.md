#### Migrate AI agent setups to the Nx agent plugins

Nx no longer writes rules files or copies skills into the workspace. Instead, `nx configure-ai-agents` registers the Nx agent plugin for Claude Code, Cursor, Codex and OpenCode, which ships the Nx MCP server, skills, subagents and guidelines. GitHub Copilot and Gemini are no longer configured.

This migration:

- Removes every Nx guidelines block (`<!-- nx configuration start-->` … `<!-- nx configuration end-->`) from `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` and the file Gemini's `contextFileName` points to, and deletes the file if nothing else is left in it.
- Registers the Nx plugin for every agent the workspace had set up:
  - Claude Code: `.claude/settings.json`
  - Cursor: `.cursor/settings.json`
  - Codex: `.codex/config.toml` (the `nx-mcp` server entry is removed; the plugin provides it)
  - OpenCode: `opencode.json` (the `nx-mcp` server entry is removed; the plugin provides it)
- Removes the GitHub Copilot and Gemini setups: the skills, prompts, commands and subagents copied under `.github`, `.gemini` and `.agents`, the `nx-mcp` server in `.gemini/settings.json` (the file is deleted if nothing else is left), and a `contextFileName` pointing at the `AGENTS.md` Nx wrote.
- Deletes the skills, commands and subagents earlier versions copied for the plugin agents.

Files that were edited after they were copied are kept and listed.

#### Sample Code Changes

##### Before

```toml title=".codex/config.toml"
[mcp_servers."nx-mcp"]
command = "npx"
args = ["nx", "mcp"]
```

##### After

```toml title=".codex/config.toml"
[plugins."nx@nx-agent-plugins"]
enabled = true
```

Codex installs plugins per user, so each developer using Codex runs `nx configure-ai-agents` once to install the plugin on their machine.
