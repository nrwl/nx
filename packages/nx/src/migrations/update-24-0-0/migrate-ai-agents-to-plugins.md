#### Migrate AI agent setups to the Nx agent plugins

Nx no longer writes rules files or copies skills into the workspace for Claude Code, Cursor, Codex and OpenCode. Instead, `nx configure-ai-agents` registers the Nx agent plugin for each agent, which ships the Nx MCP server, skills, subagents and guidelines.

This migration:

- Removes the Nx guidelines block (`<!-- nx configuration start-->` … `<!-- nx configuration end-->`) from `AGENTS.md`, `CLAUDE.md` and `GEMINI.md`, and deletes the file if nothing else is left in it.
- Registers the Nx plugin for every agent the workspace had set up:
  - Claude Code: `.claude/settings.json`
  - Cursor: `.cursor/settings.json`
  - Codex: `.codex/config.toml` (the `nx-mcp` server entry is removed; the plugin provides it)
  - OpenCode: `opencode.json` (the `nx-mcp` server entry is removed; the plugin provides it)
- Deletes the skills, commands and subagents earlier versions copied for those agents. Files that were edited after they were copied are kept.

Copilot and Gemini have no plugin; their copied files are left in place.

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
