---
name: nx-workspace
description: "Explore and understand Nx workspaces. USE WHEN answering any questions about the nx workspace, the projects in it or tasks to run. EXAMPLES: 'What projects are in this workspace?', 'How is project X configured?', 'What targets can I run?', 'What's affected by my changes?', 'Which projects depend on library Y?', or any questions about Nx workspace structure, project configuration, or available tasks."
---

# Nx Workspace Exploration

This skill provides read-only exploration of Nx workspaces. Use it to understand workspace structure, project configuration, available targets, and dependencies.

Keep in mind that you might have to prefix commands with `npx`/`pnpx`/`yarn` if nx isn't installed globally. Check the lockfile to determine the package manager in use.

## Listing Projects

Use `nx show projects` to list projects in the workspace.

```bash
# List all projects
nx show projects

# Filter by pattern (glob)
nx show projects --projects "apps/*"
nx show projects --projects "shared-*"

# Filter by project type
nx show projects --type app
nx show projects --type lib
nx show projects --type e2e

# Filter by target (projects that have a specific target)
nx show projects --withTarget build
nx show projects --withTarget e2e

# Find affected projects (changed since base branch)
nx show projects --affected
nx show projects --affected --base=main
nx show projects --affected --type app

# Combine filters
nx show projects --type lib --withTarget test
nx show projects --affected --exclude="*-e2e"

# Output as JSON
nx show projects --json
```

## Project Configuration

Use `nx show project <name> --json` to get the full resolved configuration for a project.

**Important**: Do NOT read `project.json` directly - it only contains partial configuration. The `nx show project` command returns the full resolved config including inferred targets from plugins.

You can read the full project schema at `node_modules/nx/schemas/project-schema.json` to understand nx project configuration options.

```bash
# Get full project configuration
nx show project my-app --json

# Extract specific parts from the JSON
nx show project my-app --json | jq '.targets'
nx show project my-app --json | jq '.targets.build'
nx show project my-app --json | jq '.targets | keys'


# Check project metadata
nx show project my-app --json | jq '{name, root, sourceRoot, projectType, tags}'
```

## Target Information

Targets define what tasks can be run on a project.

```bash
# List all targets for a project
nx show project my-app --json | jq '.targets | keys'

# Get full target configuration
nx show project my-app --json | jq '.targets.build'

# Check target executor/command
nx show project my-app --json | jq '.targets.build.executor'
nx show project my-app --json | jq '.targets.build.command'

# View target options
nx show project my-app --json | jq '.targets.build.options'

# Check target inputs/outputs (for caching)
nx show project my-app --json | jq '.targets.build.inputs'
nx show project my-app --json | jq '.targets.build.outputs'

# Find projects with a specific target
nx show projects --withTarget serve
nx show projects --withTarget e2e
```

## Workspace Configuration

Read `nx.json` directly for workspace-level configuration.
You can read the full project schema at `node_modules/nx/schemas/nx-schema.json` to understand nx project configuration options.

```bash
# Read the full nx.json
cat nx.json

# Or use jq for specific sections
cat nx.json | jq '.targetDefaults'
cat nx.json | jq '.namedInputs'
cat nx.json | jq '.plugins'
cat nx.json | jq '.generators'
```

Key nx.json sections:

- `targetDefaults` - Default configuration applied to all targets of a given name
- `namedInputs` - Reusable input definitions for caching
- `plugins` - Nx plugins and their configuration
- ...and much more, read the schema or nx.json for details

## Affected Projects

Find projects affected by changes in the current branch.

```bash
# Affected since base branch (auto-detected)
nx show projects --affected

# Affected with explicit base
nx show projects --affected --base=main
nx show projects --affected --base=origin/main

# Affected between two commits
nx show projects --affected --base=abc123 --head=def456

# Affected apps only
nx show projects --affected --type app

# Affected excluding e2e projects
nx show projects --affected --exclude="*-e2e"

# Affected by uncommitted changes
nx show projects --affected --uncommitted

# Affected by untracked files
nx show projects --affected --untracked
```

## Common Exploration Patterns

### "What's in this workspace?"

```bash
nx show projects
nx show projects --type app
nx show projects --type lib
```

### "How do I build/test/lint project X?"

```bash
nx show project X --json | jq '.targets | keys'
nx show project X --json | jq '.targets.build'
```

### "What depends on library Y?"

```bash
# Find projects that may depend on Y by searching for imports
# (Nx doesn't have a direct "dependents" command via CLI)
grep -r "from '@myorg/Y'" --include="*.ts" --include="*.tsx" apps/ libs/
```

### "What configuration options are available?"

```bash
cat node_modules/nx/schemas/nx-schema.json | jq '.properties | keys'
cat node_modules/nx/schemas/project-schema.json | jq '.properties | keys'
```

### "Why is project X affected?"

```bash
# Check what files changed
git diff --name-only main

# See which project owns those files
nx show project X --json | jq '.root'
```
