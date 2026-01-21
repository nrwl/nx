---
source: configure-ai-agents-update.md
created: 2026-01-20
status: complete

state:
  phase: review
  scope: narrow

  codebase_context:
    - reference: 'configure-ai-agents command'
      location: 'packages/nx/src/command-line/configure-ai-agents/'
      summary: 'CLI command that orchestrates AI agent configuration, supports --check mode, interactive selection, and configures multiple agents'
    - reference: 'set-up-ai-agents generator'
      location: 'packages/nx/src/ai/set-up-ai-agents/set-up-ai-agents.ts'
      summary: 'Core generator that writes rules files (CLAUDE.md, AGENTS.md, GEMINI.md) and MCP configs. Uses Tree API for file operations.'
    - reference: 'AI utils'
      location: 'packages/nx/src/ai/utils.ts'
      summary: 'Defines supportedAgents array (claude, codex, copilot, cursor, gemini), AgentConfiguration type, and agent detection logic'
    - reference: 'cloneTemplate utility'
      location: 'packages/create-nx-workspace/src/utils/template/clone-template.ts'
      summary: 'Git shallow clone utility with depth=1, removes .git dir after clone. No caching mechanism.'
    - reference: 'git-utils'
      location: 'packages/nx/src/utils/git-utils.ts'
      summary: 'More advanced git utility with GitRepository class, cloneFromUpstream function, supports custom depth'
    - reference: 'nx-ai-agents-config repo'
      location: 'https://github.com/nrwl/nx-ai-agents-config'
      summary: 'External repo with nx-claude-plugin/, .claude-plugin/, nx-plugins/ directories containing skills, commands, agents'

  question_queue: []

  answered_questions:
    - id: q1
      topic: repo_structure
      question: 'What is the exact structure inside nx-ai-agents-config that we should clone? Is there a specific directory layout for each agent?'
      answer: 'The nx-ai-agents-config repo should handle the raw artifacts -> agent-specific format transformation. Generated output goes in ./generated/.cursor, ./generated/.github, etc. The Nx repo just looks at those folders and copies them directly.'
      spawned: [q6, q7]
    - id: q2
      topic: caching
      question: 'Where should the cloned repo be cached? In a temp directory, user home, or workspace?'
      answer: 'Use system tmp directory (/tmp/nx-ai-agents-config/). Cache key is the latest commit hash (first 10 chars) as subfolder name. Flow: get latest commit hash of main branch -> look for hash subfolder -> if exists use cached, if not clone fresh.'
      spawned: [q8, q9]
    - id: q8
      topic: cache_cleanup
      question: 'Should we clean up old cached versions when a new one is fetched?'
      answer: 'Yes, delete old cached versions after successfully cloning the new one.'
      spawned: []
    - id: q9
      topic: offline_fallback
      question: "What should happen if we can't reach GitHub to get the latest commit hash?"
      answer: 'Fail with error for now. Can be made smarter later if needed.'
      spawned: []
    - id: q3
      topic: opencode_addition
      question: 'OpenCode is a new agent - what configuration files does it need beyond AGENTS.md?'
      answer: "OpenCode gets MCP via config file (like Claude/Gemini/Codex). It's a CLI tool (no editor detection needed). Display name is 'OpenCode'."
      spawned: [q10]
    - id: q10
      topic: opencode_mcp_location
      question: 'Where does OpenCode store its MCP config - project-level or user home?'
      answer: 'Project-level (opencode.json or .opencode/opencode.json), following the Claude/Gemini pattern rather than Codex.'
      spawned: []
    - id: q4
      topic: distribution_mapping
      question: 'Can you confirm the exact mapping of what each agent gets?'
      answer: 'Mapping confirmed. Claude gets plugin only (bundles commands/skills/subagents internally). Other agents get individual pieces: OpenCode/Copilot get commands+skills+subagents, Cursor/Codex/Gemini get commands+skills only. Use separate plugin boolean rather than commands/skills/subagents all true for Claude - cleaner model that reflects actual distribution mechanism.'
      spawned: [q11]
    - id: q11
      topic: claude_plugin_install
      question: "How should the Claude plugin be installed - via 'claude plugin install' CLI or by copying files?"
      answer: 'Use Option 2: write to .claude/settings.json with extraKnownMarketplaces pointing to nrwl/nx-ai-agents-config GitHub repo, plus enabledPlugins to auto-enable. Declarative approach, no shell commands needed, team-friendly with auto-prompts.'
      spawned: []
    - id: q7
      topic: generated_structure
      question: 'What exact folder names should be in ./generated/ for each agent?'
      answer: 'Use dot-prefixed names (.opencode, .cursor, .github, .codex, .gemini) so files can be copied directly without renaming. Must merge with existing files rather than overwrite.'
      spawned: [q12]
    - id: q12
      topic: merge_strategy
      question: "How should we handle merging Nx-provided files with user's existing files?"
      answer: "Use nx- prefix for all Nx-provided files (e.g., nx-generate.md). Subfolders don't work universally (Cursor and Copilot don't support nested commands/skills). Simply overwrite the nx-* files on each update. Edge case of user having same filename is acceptable."
      spawned: []
    - id: q13
      topic: nx_ai_agents_config_scope
      question: 'What level of detail should the plan include for nx-ai-agents-config repo changes?'
      answer: 'Just structure requirements - what the repo must provide for Nx to do its thing. Details of generation will be specced separately.'
      spawned: []

  key_decisions:
    - 'nx-ai-agents-config repo handles all artifact transformation, outputs to ./generated/'
    - 'Cache cloned repo in /tmp/nx-ai-agents-config/<commit-hash-10-chars>/'
    - 'Delete old cache versions after successful clone; fail with error if offline'
    - "OpenCode added as new agent (CLI tool, project-level config, display name 'OpenCode')"
    - 'Claude gets plugin via extraKnownMarketplaces in .claude/settings.json - no cloning needed for Claude'
    - 'Other agents get files copied from generated/ folders with nx- prefix'
    - 'Use flat file structure with nx- prefix (not subfolders) due to agent limitations'
    - 'Simply overwrite nx-* files on update - no merge logic needed'

  open_threads: []

  splits_identified:
    - title: 'nx-ai-agents-config repo implementation'
      reason: 'Generation logic and source artifact management is separate scope'

  coherence_check:
    sufficient_for_spec: true
    blocking_gaps: []
---

## Spec Content

### Overview

Enhance `configure-ai-agents` to distribute additional extensibility artifacts (commands, skills, subagents, plugins) from the `https://github.com/nrwl/nx-ai-agents-config` repository.

### Agent Distribution Matrix

| Agent              | Rules     | MCP Config            | Commands | Skills | Subagents | Plugin                |
| ------------------ | --------- | --------------------- | -------- | ------ | --------- | --------------------- |
| **Claude**         | CLAUDE.md | .mcp.json             | -        | -      | -         | Yes (via marketplace) |
| **OpenCode** (new) | AGENTS.md | opencode.json         | Yes      | Yes    | Yes       | -                     |
| **GitHub Copilot** | AGENTS.md | Nx Console            | Yes      | Yes    | Yes       | -                     |
| **Cursor**         | AGENTS.md | Nx Console            | Yes      | Yes    | -         | -                     |
| **Codex CLI**      | AGENTS.md | ~/.codex/config.toml  | Yes      | Yes    | -         | -                     |
| **Gemini CLI**     | GEMINI.md | .gemini/settings.json | Yes      | Yes    | -         | -                     |

---

## Implementation Plan - Nx Repository

### 1. Add OpenCode as New Agent

**File:** `packages/nx/src/ai/utils.ts`

- Add `'opencode'` to `supportedAgents` array
- Add display name mapping: `opencode: 'OpenCode'`
- Update `AgentConfiguration` type if needed

**File:** `packages/nx/src/ai/constants.ts`

- Add `opencodeMcpPath` function (returns `opencode.json` in workspace root)

**File:** `packages/nx/src/ai/set-up-ai-agents/set-up-ai-agents.ts`

- Add OpenCode handling in generator:
  - Write AGENTS.md (same as cursor/copilot/codex)
  - Create/update `opencode.json` with nx-mcp server config

### 2. Create Repo Clone & Cache Utility

**New File:** `packages/nx/src/ai/clone-ai-config-repo.ts`

```typescript
const REPO_URL = 'https://github.com/nrwl/nx-ai-agents-config';
const CACHE_DIR = '/tmp/nx-ai-agents-config';

export async function getAiConfigRepoPath(): Promise<string> {
  // 1. Get latest commit hash (first 10 chars) via git ls-remote
  const commitHash = await getLatestCommitHash(REPO_URL);

  // 2. Check if cached version exists
  const cachedPath = join(CACHE_DIR, commitHash);
  if (existsSync(cachedPath)) {
    return cachedPath;
  }

  // 3. Clone fresh
  await cloneRepo(REPO_URL, cachedPath);

  // 4. Clean up old cached versions
  await cleanupOldCaches(CACHE_DIR, commitHash);

  return cachedPath;
}
```

**Key behaviors:**

- Use `git ls-remote <url> HEAD` to get commit hash without cloning
- Cache key is first 10 chars of commit hash
- Shallow clone with `--depth 1`
- Delete old cache folders after successful clone
- Fail with clear error if network unavailable

### 3. Update Generator to Copy Extensibility Artifacts

**File:** `packages/nx/src/ai/set-up-ai-agents/set-up-ai-agents.ts`

For non-Claude agents, after writing rules/MCP config:

```typescript
if (
  hasAgent('opencode') ||
  hasAgent('copilot') ||
  hasAgent('cursor') ||
  hasAgent('codex') ||
  hasAgent('gemini')
) {
  const repoPath = await getAiConfigRepoPath();

  if (hasAgent('opencode')) {
    copyArtifacts(tree, repoPath, 'generated/.opencode', '.opencode');
  }
  if (hasAgent('copilot')) {
    copyArtifacts(tree, repoPath, 'generated/.github', '.github');
  }
  if (hasAgent('cursor')) {
    copyArtifacts(tree, repoPath, 'generated/.cursor', '.cursor');
  }
  if (hasAgent('codex')) {
    copyArtifacts(tree, repoPath, 'generated/.codex', '.codex');
  }
  if (hasAgent('gemini')) {
    copyArtifacts(tree, repoPath, 'generated/.gemini', '.gemini');
  }
}
```

**Copy behavior:**

- Copy all `nx-*` prefixed files from source to destination
- Overwrite existing `nx-*` files (no merge logic)
- Preserve user's non-nx-prefixed files

### 4. Claude Plugin via Marketplace

**File:** `packages/nx/src/ai/set-up-ai-agents/set-up-ai-agents.ts`

For Claude, update `.claude/settings.json` (in addition to existing `.mcp.json`):

```typescript
if (hasAgent('claude')) {
  // Existing: write CLAUDE.md and .mcp.json

  // New: configure plugin marketplace
  const claudeSettingsPath = join(
    options.directory,
    '.claude',
    'settings.json'
  );
  if (!tree.exists(claudeSettingsPath)) {
    writeJson(tree, claudeSettingsPath, {});
  }
  updateJson(tree, claudeSettingsPath, (json) => ({
    ...json,
    extraKnownMarketplaces: {
      ...json.extraKnownMarketplaces,
      nx: {
        source: {
          source: 'github',
          repo: 'nrwl/nx-ai-agents-config',
        },
      },
    },
    enabledPlugins: {
      ...json.enabledPlugins,
      'nx-plugin@nx': true,
    },
  }));
}
```

### 5. Update Agent Configuration Detection

**File:** `packages/nx/src/ai/utils.ts`

Update `getAgentConfiguration` to detect new artifacts:

- For OpenCode: check for `opencode.json` MCP config
- For all agents: optionally check for presence of `nx-*` command/skill files

---

## Required Structure in nx-ai-agents-config Repository

The Nx implementation expects this structure:

```
nx-ai-agents-config/
├── generated/
│   ├── .opencode/
│   │   ├── command/
│   │   │   └── nx-*.md
│   │   ├── skill/
│   │   │   └── nx-*/
│   │   │       └── SKILL.md
│   │   └── agent/
│   │       └── nx-*.md
│   ├── .github/
│   │   ├── prompts/
│   │   │   └── nx-*.prompt.md
│   │   ├── skills/
│   │   │   └── nx-*/
│   │   │       └── SKILL.md
│   │   └── agents/
│   │       └── nx-*.agent.md
│   ├── .cursor/
│   │   ├── commands/
│   │   │   └── nx-*.md
│   │   └── skills/
│   │       └── nx-*/
│   │           └── SKILL.md
│   ├── .codex/
│   │   ├── prompts/
│   │   │   └── nx-*.md
│   │   └── skills/
│   │       └── nx-*/
│   │           └── SKILL.md
│   └── .gemini/
│       ├── commands/
│       │   └── nx-*.toml
│       └── skills/
│           └── nx-*/
│               └── skill.md
├── .claude-plugin/
│   └── marketplace.json      # Claude plugin marketplace manifest
├── (plugin source files)     # Commands, skills, agents for Claude plugin
└── (source artifacts)        # Raw artifacts before transformation
```

**Key requirements:**

- All distributed files use `nx-` prefix
- Structure matches each agent's expected format exactly
- `marketplace.json` properly configured for Claude plugin discovery

---

## Files to Modify in Nx Repository

1. `packages/nx/src/ai/utils.ts` - Add OpenCode agent
2. `packages/nx/src/ai/constants.ts` - Add OpenCode paths
3. `packages/nx/src/ai/set-up-ai-agents/set-up-ai-agents.ts` - Main generator changes
4. `packages/nx/src/ai/set-up-ai-agents/schema.d.ts` - Update schema if needed
5. `packages/nx/src/ai/clone-ai-config-repo.ts` - New file for repo cloning/caching
6. `packages/create-nx-workspace/src/create-workspace-options.ts` - Add OpenCode to agent list

---

## Suggested Follow-ups

- **nx-ai-agents-config repo implementation** - Spec out the generation process that transforms source artifacts into agent-specific formats
