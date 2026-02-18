# nx import Agent Mode Design

## Goal

Optimize `nx import` for AI agents, matching the patterns established by `nx init` and `create-nx-workspace`. When an agent is detected, skip all interactive prompts and emit NDJSON output so the agent can parse progress, handle missing inputs, and report results structurally.

## Architecture

### Shared AI Output Infrastructure

Extract common AI output types and utilities into a shared module. Each command extends with its own specific types.

**New shared module:** `packages/nx/src/command-line/ai/ai-output.ts`

Contains:
- Base types: `ProgressMessage`, `ErrorResult`, `NextStep`, `UserNextSteps`, `DetectedPlugin`, `PluginWarning`
- Base utilities: `writeAiOutput()`, `logProgress()`, `writeErrorLog()`, `determineErrorCode()`, `getErrorHints()`
- Base progress stages: `'starting' | 'complete' | 'error' | 'needs_input'`

`writeAiOutput()` writes `JSON.stringify(message) + '\n'` to stdout. Only outputs when `isAiAgent()` returns true.

**Refactored init module:** `packages/nx/src/command-line/init/utils/ai-output.ts`

Becomes a thin layer that re-exports shared base types and adds init-specific extensions:
- `InitProgressStage = BaseProgressStage | 'detecting' | 'configuring' | 'installing' | 'plugins'`
- `NxInitErrorCode` (unchanged)
- `buildNeedsInputResult()`, `buildSuccessResult()`, `buildErrorResult()` (init-specific builders)

### Import-Specific AI Output

**New file:** `packages/nx/src/command-line/import/utils/ai-output.ts`

**Progress stages:**
```
ImportProgressStage = BaseProgressStage | 'cloning' | 'filtering' | 'merging' | 'detecting-plugins' | 'installing'
```

**Error codes:**
```
NxImportErrorCode =
  | 'UNCOMMITTED_CHANGES'
  | 'CLONE_FAILED'
  | 'SOURCE_NOT_FOUND'
  | 'DESTINATION_NOT_EMPTY'
  | 'INVALID_DESTINATION'
  | 'FILTER_FAILED'
  | 'MERGE_FAILED'
  | 'PACKAGE_INSTALL_ERROR'
  | 'PLUGIN_INIT_ERROR'
  | 'UNKNOWN'
```

**NeedsInput variants:**

1. `inputType: 'import_options'` -- when required args are missing:
```json
{
  "stage": "needs_input",
  "success": false,
  "inputType": "import_options",
  "message": "Required options missing. Re-invoke with the listed flags.",
  "missingFields": ["ref", "destination"],
  "availableOptions": {
    "sourceRepository": { "description": "URL or path of repo to import", "flag": "--sourceRepository", "required": true },
    "ref": { "description": "Branch to import", "flag": "--ref", "required": true },
    "source": { "description": "Directory within source repo to import (blank = entire repo)", "flag": "--source", "required": false },
    "destination": { "description": "Target directory in this workspace", "flag": "--destination", "required": true }
  },
  "exampleCommand": "nx import https://github.com/org/repo --ref=main --source=apps/my-app --destination=apps/my-app"
}
```

2. `inputType: 'plugins'` -- after merge completes, when plugins detected and no `--plugins` flag:
```json
{
  "stage": "needs_input",
  "success": false,
  "inputType": "plugins",
  "message": "Plugin selection required. Ask the user which plugins to install, then run again with --plugins flag.",
  "detectedPlugins": [{ "name": "@nx/vite", "reason": "Found vite in dependencies" }],
  "options": ["--plugins=skip", "--plugins=all", "--plugins=@nx/vite"],
  "recommendedOption": "--plugins=skip",
  "recommendedReason": "Plugins can be added later with nx add.",
  "exampleCommand": "nx import ... --plugins=all"
}
```

All missing fields are reported at once to minimize round-trips.

**Success result** includes: source repo, destination path, branch imported, plugins installed, warnings (package manager mismatch, config path differences, missing root deps).

### Agent Mode Flow in import.ts

At entry:
- `isAiAgent()` check, force `interactive = false`
- Emit `logProgress('starting', 'Importing repository...')`

Missing arguments check (before any git operations):
- `sourceRepository` missing -> add to `missingFields`
- `ref` missing -> add to `missingFields`
- `destination` missing -> add to `missingFields`
- `source` is optional, never "missing"
- If any missing -> emit `needs_input` with `inputType: 'import_options'`, exit 0
- `availableOptions` always lists all 4 fields (including optional `source`) so the agent knows it can scope imports

During git operations (no prompts, no spinners):
- `logProgress('cloning', 'Cloning {repo}...')`
- `logProgress('filtering', 'Filtering git history...')`
- `logProgress('merging', 'Merging into workspace...')`

Plugin detection (after merge):
- `logProgress('detecting-plugins', 'Checking for recommended plugins...')`
- If plugins detected and no `--plugins` flag -> emit `needs_input` with `inputType: 'plugins'`, exit 0
- If `--plugins=skip|all|list` provided -> proceed with install
- `logProgress('installing', 'Installing plugins...')`

On success:
- Emit structured success result with all info
- Suppress `output.log` / `output.warn` calls in agent mode

On error:
- Catch at top level in command-object.ts handler
- Emit error NDJSON with appropriate error code
- Write detailed error log via `writeErrorLog()`

### Command Object Changes

`packages/nx/src/command-line/import/command-object.ts`:

1. Add `--plugins` option:
   - `--plugins=skip` -> no plugins
   - `--plugins=all` -> install all detected
   - `--plugins=@nx/vite,@nx/jest` -> specific list
   - Not provided -> agent mode emits `needs_input`; human mode shows interactive prompt

2. Top-level error handler:
   - Agent mode: catch errors, determine error code, write error log, emit error NDJSON, exit 1
   - Human mode: existing behavior unchanged

## Non-Goals

- No changes to git operations (clone, filter, merge)
- No changes to human/interactive mode behavior
- No changes to `create-nx-workspace` (has its own ai-output copy)
- No new CLI flags beyond `--plugins`
- Agent detection is automatic via environment variables

## E2E Testing

**New file:** `e2e/nx/src/import-ai-agent.test.ts`

Mirror existing import tests but with `CLAUDECODE=1` env var set, asserting on NDJSON output.

**Test cases:**

1. **Missing args -> needs_input response**
   - Invoke `nx import https://... --ref=main` (missing `--destination`)
   - Assert: NDJSON with `inputType: 'import_options'`, `missingFields` includes `destination`, `availableOptions` lists all 4 fields
   - Assert: exit code 0

2. **Full import with all args -> progress + needs_input for plugins**
   - Provide all flags except `--plugins`, set `CLAUDECODE=1`
   - Assert: progress lines for `starting`, `cloning`, `filtering`, `merging`
   - Assert: `needs_input` with `inputType: 'plugins'`
   - Assert: files actually imported

3. **Full import with --plugins=skip -> complete success**
   - Provide all flags including `--plugins=skip`
   - Assert: progress lines through to `complete`
   - Assert: success result with no plugins installed
   - Assert: no interactive prompts in stdout

4. **Full import with --plugins=all -> plugins installed**
   - Provide all flags including `--plugins=all`
   - Assert: success result includes `pluginsInstalled`
   - Assert: plugins configured in `nx.json`

5. **Import subdirectory -> correct paths in output**
   - Import `packages/a` from a multi-package repo
   - Assert: success result reflects correct source/destination paths

6. **Error cases -> structured error NDJSON**
   - Uncommitted changes -> `UNCOMMITTED_CHANGES`
   - Bad repo URL -> `CLONE_FAILED`
   - Non-empty destination -> `DESTINATION_NOT_EMPTY`

**Test helper:** `parseNdjsonOutput(stdout)` utility that splits on newlines, parses JSON lines, filters out `---USER_NEXT_STEPS---` plain text.
