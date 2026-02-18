# nx import Agent Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add AI agent support to `nx import` so agents get NDJSON output, no interactive prompts, and structured needs_input/success/error results.

**Architecture:** Extract shared AI output base types from `init/utils/ai-output.ts` into a new `command-line/ai/ai-output.ts` shared module. Add import-specific types extending the base. Modify `importHandler` to branch on `isAiAgent()` — skip prompts/spinners, emit NDJSON progress, handle missing args with `needs_input`, and add `--plugins` flag support.

**Tech Stack:** TypeScript, Node.js native APIs, existing Nx e2e test infrastructure

**Design doc:** `docs/plans/2026-02-18-nx-import-agent-mode-design.md`

---

### Task 1: Extract shared AI output base module

**Files:**

- Create: `packages/nx/src/command-line/ai/ai-output.ts`
- Modify: `packages/nx/src/command-line/init/utils/ai-output.ts`

**Step 1: Create the shared base module**

Create `packages/nx/src/command-line/ai/ai-output.ts` with the base types and utilities extracted from `init/utils/ai-output.ts`:

```typescript
/**
 * Shared AI Agent NDJSON Output Utilities
 *
 * Base types and utilities for AI agent output across all Nx commands.
 * Each command extends with its own specific progress stages, error codes, and result types.
 */

import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync } from 'fs';
import { isAiAgent } from '../../native';

// Base progress stages shared by all commands
export type BaseProgressStage =
  | 'starting'
  | 'complete'
  | 'error'
  | 'needs_input';

export interface ProgressMessage {
  stage: string;
  message: string;
}

export interface DetectedPlugin {
  name: string;
  reason: string;
}

export interface NextStep {
  title: string;
  command?: string;
  url?: string;
  note?: string;
}

export interface UserNextSteps {
  description: string;
  steps: NextStep[];
}

export interface PluginWarning {
  plugin: string;
  error: string;
  hint: string;
}

/**
 * Write NDJSON message to stdout.
 * Only outputs if running under an AI agent.
 * Each message is a single line of JSON.
 */
export function writeAiOutput(message: Record<string, unknown>): void {
  if (isAiAgent()) {
    process.stdout.write(JSON.stringify(message) + '\n');

    // For success results, output plain text instructions that the agent can show the user
    if (
      message.stage === 'complete' &&
      'success' in message &&
      message.success &&
      'userNextSteps' in message
    ) {
      const steps = (message as any).userNextSteps?.steps;
      if (Array.isArray(steps)) {
        let plainText = '\n---USER_NEXT_STEPS---\n';
        plainText +=
          '[DISPLAY] Show the user these next steps to complete setup:\n\n';

        steps.forEach((step: NextStep, i: number) => {
          plainText += `${i + 1}. ${step.title}`;
          if (step.command) {
            plainText += `\n   Run: ${step.command}`;
          }
          if (step.url) {
            plainText += `\n   Visit: ${step.url}`;
          }
          if (step.note) {
            plainText += `\n   ${step.note}`;
          }
          plainText += '\n';
        });

        plainText += '---END---\n';
        process.stdout.write(plainText);
      }
    }
  }
}

/**
 * Log progress stage.
 * Only outputs if running under an AI agent.
 */
export function logProgress(stage: string, message: string): void {
  writeAiOutput({ stage, message });
}

/**
 * Write detailed error information to a temp file for AI debugging.
 * Returns the path to the error log file.
 */
export function writeErrorLog(
  error: Error | unknown,
  commandName: string = 'nx'
): string {
  const timestamp = Date.now();
  const errorLogPath = join(tmpdir(), `${commandName}-error-${timestamp}.log`);

  let errorDetails = `Nx ${commandName} Error Log\n`;
  errorDetails += `==================\n`;
  errorDetails += `Timestamp: ${new Date(timestamp).toISOString()}\n\n`;

  if (error instanceof Error) {
    errorDetails += `Error: ${error.message}\n\n`;
    if (error.stack) {
      errorDetails += `Stack Trace:\n${error.stack}\n`;
    }
  } else {
    errorDetails += `Error: ${String(error)}\n`;
  }

  try {
    writeFileSync(errorLogPath, errorDetails);
  } catch {
    return '';
  }

  return errorLogPath;
}
```

**Step 2: Refactor init/utils/ai-output.ts to import from shared base**

Replace the duplicated code in `packages/nx/src/command-line/init/utils/ai-output.ts`. Keep all init-specific types and builders, but re-export the shared base types and utilities:

```typescript
/**
 * AI Agent NDJSON Output Utilities for nx init
 *
 * Extends the shared base with init-specific types and builders.
 *
 * NOTE: This is intentionally duplicated from create-nx-workspace.
 * CNW is self-contained and cannot import from the nx package.
 */

// Re-export shared base types and utilities
export {
  writeAiOutput,
  logProgress,
  writeErrorLog,
  type ProgressMessage,
  type DetectedPlugin,
  type NextStep,
  type UserNextSteps,
  type PluginWarning,
  type BaseProgressStage,
} from '../../ai/ai-output';

// Init-specific progress stages
export type ProgressStage =
  | 'starting'
  | 'detecting'
  | 'configuring'
  | 'installing'
  | 'plugins'
  | 'complete'
  | 'error'
  | 'needs_input';

// Init-specific error codes
export type NxInitErrorCode =
  | 'ALREADY_INITIALIZED'
  | 'PACKAGE_INSTALL_ERROR'
  | 'UNCOMMITTED_CHANGES'
  | 'UNSUPPORTED_PROJECT'
  | 'PLUGIN_INIT_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

// Keep all existing interfaces: NeedsInputResult, SuccessResult, ErrorResult
// Keep all existing builder functions: buildNeedsInputResult, buildSuccessResult, buildErrorResult
// Keep: getErrorHints, determineErrorCode
// (These stay exactly as they are, just remove the duplicated base types/utilities that are now imported)
```

The key changes: remove the `writeAiOutput`, `logProgress`, `writeErrorLog` function bodies and base type definitions. Replace with imports from `../../ai/ai-output`. Keep `NeedsInputResult`, `SuccessResult`, `ErrorResult` interfaces, `buildNeedsInputResult()`, `buildSuccessResult()`, `buildErrorResult()`, `getErrorHints()`, `determineErrorCode()` exactly as-is.

**Step 3: Verify init still works**

Run: `npx nx run-many -t build,test,lint -p nx`
Expected: PASS — no behavior change, just code reorganization

**Step 4: Commit**

```bash
git add packages/nx/src/command-line/ai/ai-output.ts packages/nx/src/command-line/init/utils/ai-output.ts
git commit -m "refactor(core): extract shared AI output base module from init"
```

---

### Task 2: Create import-specific AI output types

**Files:**

- Create: `packages/nx/src/command-line/import/utils/ai-output.ts`

**Step 1: Create the import AI output module**

Create `packages/nx/src/command-line/import/utils/ai-output.ts`:

```typescript
/**
 * AI Agent NDJSON Output Utilities for nx import
 *
 * Extends the shared base with import-specific types and builders.
 */

import {
  writeAiOutput,
  logProgress,
  writeErrorLog,
  type DetectedPlugin,
  type NextStep,
  type UserNextSteps,
  type PluginWarning,
} from '../../ai/ai-output';

// Re-export shared utilities for convenience
export { writeAiOutput, logProgress, writeErrorLog };

// Import-specific progress stages
export type ImportProgressStage =
  | 'starting'
  | 'cloning'
  | 'filtering'
  | 'merging'
  | 'detecting-plugins'
  | 'installing'
  | 'complete'
  | 'error'
  | 'needs_input';

// Import-specific error codes
export type NxImportErrorCode =
  | 'UNCOMMITTED_CHANGES'
  | 'CLONE_FAILED'
  | 'SOURCE_NOT_FOUND'
  | 'DESTINATION_NOT_EMPTY'
  | 'INVALID_DESTINATION'
  | 'FILTER_FAILED'
  | 'MERGE_FAILED'
  | 'PACKAGE_INSTALL_ERROR'
  | 'PLUGIN_INIT_ERROR'
  | 'UNKNOWN';

interface ImportOptionInfo {
  description: string;
  flag: string;
  required: boolean;
}

export interface ImportNeedsOptionsResult {
  stage: 'needs_input';
  success: false;
  inputType: 'import_options';
  message: string;
  missingFields: string[];
  availableOptions: Record<string, ImportOptionInfo>;
  exampleCommand: string;
}

export interface ImportNeedsPluginsResult {
  stage: 'needs_input';
  success: false;
  inputType: 'plugins';
  message: string;
  detectedPlugins: DetectedPlugin[];
  options: string[];
  recommendedOption: string;
  recommendedReason: string;
  exampleCommand: string;
}

export interface ImportSuccessResult {
  stage: 'complete';
  success: true;
  result: {
    sourceRepository: string;
    ref: string;
    source: string;
    destination: string;
    pluginsInstalled: string[];
  };
  warnings?: ImportWarning[];
  userNextSteps: UserNextSteps;
  docs: {
    gettingStarted: string;
    nxImport: string;
  };
}

export interface ImportWarning {
  type:
    | 'package_manager_mismatch'
    | 'config_path_mismatch'
    | 'missing_root_deps'
    | 'install_failed'
    | 'plugin_install_failed';
  message: string;
  hint: string;
}

export interface ImportErrorResult {
  stage: 'error';
  success: false;
  errorCode: NxImportErrorCode;
  error: string;
  hints: string[];
  errorLogPath?: string;
}

export type ImportAiOutputMessage =
  | { stage: ImportProgressStage; message: string }
  | ImportNeedsOptionsResult
  | ImportNeedsPluginsResult
  | ImportSuccessResult
  | ImportErrorResult;

const AVAILABLE_OPTIONS: Record<string, ImportOptionInfo> = {
  sourceRepository: {
    description: 'URL or path of the repository to import',
    flag: '--sourceRepository',
    required: true,
  },
  ref: {
    description: 'Branch to import from the source repository',
    flag: '--ref',
    required: true,
  },
  source: {
    description:
      'Directory within the source repo to import (blank = entire repo)',
    flag: '--source',
    required: false,
  },
  destination: {
    description: 'Target directory in this workspace to import into',
    flag: '--destination',
    required: true,
  },
};

export function buildImportNeedsOptionsResult(
  missingFields: string[],
  sourceRepository?: string
): ImportNeedsOptionsResult {
  const exampleRepo = sourceRepository || 'https://github.com/org/repo';
  return {
    stage: 'needs_input',
    success: false,
    inputType: 'import_options',
    message: 'Required options missing. Re-invoke with the listed flags.',
    missingFields,
    availableOptions: AVAILABLE_OPTIONS,
    exampleCommand: `nx import ${exampleRepo} --ref=main --source=apps/my-app --destination=apps/my-app`,
  };
}

export function buildImportNeedsPluginsResult(
  detectedPlugins: DetectedPlugin[],
  importCommand: string
): ImportNeedsPluginsResult {
  const pluginList = detectedPlugins.map((p) => p.name).join(',');
  return {
    stage: 'needs_input',
    success: false,
    inputType: 'plugins',
    message:
      'Plugin selection required. Ask the user which plugins to install, then run again with --plugins flag.',
    detectedPlugins,
    options: ['--plugins=skip', '--plugins=all', `--plugins=${pluginList}`],
    recommendedOption: '--plugins=skip',
    recommendedReason: 'Plugins can be added later with nx add.',
    exampleCommand: `${importCommand} --plugins=all`,
  };
}

export function buildImportSuccessResult(options: {
  sourceRepository: string;
  ref: string;
  source: string;
  destination: string;
  pluginsInstalled: string[];
  warnings?: ImportWarning[];
}): ImportSuccessResult {
  const steps: NextStep[] = [
    {
      title: 'Explore your workspace',
      command: 'nx graph',
      note: 'Visualize project dependencies including imported projects',
    },
    {
      title: 'List imported projects',
      command: 'nx show projects',
      note: 'Verify the imported projects appear in the workspace',
    },
    {
      title: 'Run a task on imported code',
      command: `nx run <project>:<target>`,
      note: 'Test that imported projects build and run correctly',
    },
  ];

  const result: ImportSuccessResult = {
    stage: 'complete',
    success: true,
    result: {
      sourceRepository: options.sourceRepository,
      ref: options.ref,
      source: options.source,
      destination: options.destination,
      pluginsInstalled: options.pluginsInstalled,
    },
    userNextSteps: {
      description: 'Show user these steps to verify the import.',
      steps,
    },
    docs: {
      gettingStarted: 'https://nx.dev/getting-started/intro',
      nxImport: 'https://nx.dev/nx-api/nx/documents/import',
    },
  };

  if (options.warnings && options.warnings.length > 0) {
    result.warnings = options.warnings;
  }

  return result;
}

export function buildImportErrorResult(
  error: string,
  errorCode: NxImportErrorCode,
  errorLogPath?: string
): ImportErrorResult {
  return {
    stage: 'error',
    success: false,
    errorCode,
    error,
    hints: getImportErrorHints(errorCode),
    errorLogPath,
  };
}

export function getImportErrorHints(errorCode: NxImportErrorCode): string[] {
  switch (errorCode) {
    case 'UNCOMMITTED_CHANGES':
      return [
        'Commit or stash your changes before running nx import',
        'Run "git status" to see uncommitted changes',
      ];
    case 'CLONE_FAILED':
      return [
        'Check the repository URL is correct and accessible',
        'Ensure you have the necessary permissions to clone',
        'For local paths, verify the directory exists',
      ];
    case 'SOURCE_NOT_FOUND':
      return [
        'The specified source directory does not exist in the source repository',
        'Check the directory path and branch name',
        'Omit --source to import the entire repository',
      ];
    case 'DESTINATION_NOT_EMPTY':
      return [
        'The destination directory already contains files',
        'Choose a different destination or remove existing files',
      ];
    case 'INVALID_DESTINATION':
      return [
        'The destination must be a relative path within the workspace',
        'Do not use absolute paths',
      ];
    case 'FILTER_FAILED':
      return [
        'Git history filtering failed',
        'Install git-filter-repo for faster and more reliable filtering: pip install git-filter-repo',
        'Check that the source repository has valid git history',
      ];
    case 'MERGE_FAILED':
      return [
        'Merging the imported code failed',
        'Check for conflicts between source and destination',
        'Run "git status" to see the current state',
      ];
    case 'PACKAGE_INSTALL_ERROR':
      return [
        'Package installation failed after import',
        'Run your package manager install manually',
        'Check for dependency conflicts between imported and existing packages',
      ];
    case 'PLUGIN_INIT_ERROR':
      return [
        'One or more plugin initializations failed',
        'Try running "nx add <plugin>" manually',
      ];
    default:
      return [
        'An unexpected error occurred during import',
        'Check the error log for details',
        'Report issues at https://github.com/nrwl/nx/issues',
      ];
  }
}

export function determineImportErrorCode(
  error: Error | unknown
): NxImportErrorCode {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes('uncommitted')) return 'UNCOMMITTED_CHANGES';
  if (lower.includes('failed to clone')) return 'CLONE_FAILED';
  if (lower.includes('does not exist in')) return 'SOURCE_NOT_FOUND';
  if (lower.includes('is not empty') || lower.includes('destination directory'))
    return 'DESTINATION_NOT_EMPTY';
  if (lower.includes('must be a relative path')) return 'INVALID_DESTINATION';
  if (
    lower.includes('filter-repo') ||
    lower.includes('filter-branch') ||
    lower.includes('filter')
  )
    return 'FILTER_FAILED';
  if (lower.includes('merge')) return 'MERGE_FAILED';
  if (lower.includes('install')) return 'PACKAGE_INSTALL_ERROR';
  if (lower.includes('plugin') || lower.includes('generator'))
    return 'PLUGIN_INIT_ERROR';

  return 'UNKNOWN';
}
```

**Step 2: Verify it compiles**

Run: `npx nx run-many -t build,lint -p nx`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/nx/src/command-line/import/utils/ai-output.ts
git commit -m "feat(core): add import-specific AI output types and builders"
```

---

### Task 3: Add --plugins flag to import command-object

**Files:**

- Modify: `packages/nx/src/command-line/import/command-object.ts`
- Modify: `packages/nx/src/command-line/import/import.ts` (just the `ImportOptions` interface)

**Step 1: Add --plugins option and update error handler**

In `packages/nx/src/command-line/import/command-object.ts`, add the `--plugins` option and wrap the handler with AI-aware error handling. The current handler at line 47-52 uses `handleErrors` — we need to add an AI error branch like `init/command-object.ts` does at lines 48-62.

Add after the `.option('interactive', ...)` block (after line 43):

```typescript
.option('plugins', {
  type: 'string',
  description:
    'Plugins to install after import: "skip" for none, "all" for all detected, or comma-separated list (e.g., @nx/vite,@nx/jest).',
})
```

Replace the handler (lines 47-52) with AI-aware error handling:

```typescript
handler: async (args) => {
  try {
    await (await import('./import')).importHandler(args as any);
    process.exit(0);
  } catch (error) {
    if ((await import('../../native')).isAiAgent()) {
      const { buildImportErrorResult, determineImportErrorCode, writeErrorLog } =
        await import('./utils/ai-output');
      const { writeAiOutput } = await import('../ai/ai-output');
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorCode = determineImportErrorCode(error);
      const errorLogPath = writeErrorLog(error, 'nx-import');
      writeAiOutput(buildImportErrorResult(errorMessage, errorCode, errorLogPath));
    }
    process.exit(1);
  }
},
```

**Step 2: Add `plugins` to ImportOptions interface**

In `packages/nx/src/command-line/import/import.ts`, add to the `ImportOptions` interface (after line 64):

```typescript
plugins?: string; // 'skip' | 'all' | comma-separated list
```

**Step 3: Verify it compiles**

Run: `npx nx run-many -t build,lint -p nx`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/nx/src/command-line/import/command-object.ts packages/nx/src/command-line/import/import.ts
git commit -m "feat(core): add --plugins flag and AI error handling to nx import"
```

---

### Task 4: Add agent mode branch to importHandler

This is the core task. Modify `packages/nx/src/command-line/import/import.ts` to branch on `isAiAgent()`.

**Files:**

- Modify: `packages/nx/src/command-line/import/import.ts`

**Step 1: Add imports**

At the top of `import.ts`, add these imports:

```typescript
import { isAiAgent } from '../../native';
import {
  logProgress,
  writeAiOutput,
  buildImportNeedsOptionsResult,
  buildImportNeedsPluginsResult,
  buildImportSuccessResult,
  buildImportErrorResult,
  determineImportErrorCode,
  type ImportWarning,
  type DetectedPlugin,
} from './utils/ai-output';
```

**Step 2: Add agent detection and needs_input for missing args**

At the start of `importHandler` (after line 69 `let { sourceRepository, ref, source, destination, verbose } = options;`), add:

```typescript
const aiMode = isAiAgent();
if (aiMode) {
  options.interactive = false;
  logProgress('starting', 'Importing repository...');

  // Check for missing required arguments — report all at once
  const missingFields: string[] = [];
  if (!sourceRepository) missingFields.push('sourceRepository');
  if (!ref) missingFields.push('ref');
  if (!destination) missingFields.push('destination');

  if (missingFields.length > 0) {
    writeAiOutput(
      buildImportNeedsOptionsResult(missingFields, sourceRepository)
    );
    process.exit(0);
  }
}
```

**Step 3: Replace prompts with agent-mode guards**

For each of the 4 prompts in the current code, wrap the prompt block so it only runs when NOT in aiMode. Since we already checked missing fields above and exited, prompts only run in human mode.

The existing prompt blocks (lines 93-105, 148-165, 167-177, 179-191) are already guarded by `if (!sourceRepository)`, `if (!ref)`, etc. In agent mode, these values are guaranteed to be present (we exited with `needs_input` if they weren't). No changes needed to the prompt blocks themselves.

**Step 4: Replace spinners with progress logging in agent mode**

Throughout the function, add agent-mode alternatives to spinner calls. The pattern is:

```typescript
// Before each spinner.start() / spinner.succeed():
if (aiMode) {
  logProgress('cloning', `Cloning ${sourceRepository}...`);
} else {
  spinner = createSpinner(`Cloning ${sourceRepository}...`).start();
}
```

Specifically, update these locations:

- Lines 117-119 (clone spinner start): Add `if (aiMode) { logProgress('cloning', ...); }` else create spinner
- Line 143 (clone spinner succeed): Guard with `if (!aiMode)`
- Lines 208-211 (checkout spinner): Guard with `if (!aiMode)`
- Line 217 (checkout spinner succeed): Guard with `if (!aiMode)`
- Before `prepareSourceRepo` call (line 234): Add `if (aiMode) { logProgress('filtering', 'Filtering git history...'); }`
- Before `mergeRemoteSource` call (line 249): Add `if (aiMode) { logProgress('merging', 'Merging into workspace...'); }`
- Lines 258-261 (cleanup spinner): Guard with `if (!aiMode)`

The simplest approach: declare `let spinner` at the top, only assign it in non-aiMode, and guard all `spinner.start()/.succeed()/.fail()` calls with `if (!aiMode)`.

**Step 5: Add parsePluginsFlag and plugin handling for agent mode**

Copy the `parsePluginsFlag` function from `init-v2.ts` (lines 437-454) into `import.ts` (or import it if it's exported — check first; if not, duplicate it since it's small).

Replace the plugin detection section (lines 274-279) with agent-aware logic:

```typescript
if (aiMode) {
  logProgress('detecting-plugins', 'Checking for recommended plugins...');

  const parsedPlugins = parsePluginsFlag(options.plugins);

  if (parsedPlugins === 'skip') {
    // Skip plugins entirely
    plugins = [];
    updatePackageScripts = false;
  } else {
    const detected = await detectPlugins(nxJson, packageJson, false, true);
    const detectedPluginNames = detected.plugins;

    if (parsedPlugins === 'all') {
      plugins = detectedPluginNames;
      updatePackageScripts = detected.updatePackageScripts;
    } else if (Array.isArray(parsedPlugins)) {
      plugins = parsedPlugins;
      updatePackageScripts = true;
    } else if (detectedPluginNames.length > 0) {
      // No --plugins flag and plugins detected — return needs_input
      const detectedPluginsInfo: DetectedPlugin[] = detectedPluginNames.map(
        (name) => ({ name, reason: `Detected in imported code` })
      );
      const importCmd = `nx import ${sourceRepository} ${destination} --ref ${ref}${source ? ` --source ${source}` : ''}`;
      writeAiOutput(
        buildImportNeedsPluginsResult(detectedPluginsInfo, importCmd)
      );
      process.exit(0);
    } else {
      plugins = [];
      updatePackageScripts = false;
    }
  }
} else {
  // Existing interactive plugin detection (current lines 274-279)
  const detected = await detectPlugins(
    nxJson,
    packageJson,
    options.interactive,
    true
  );
  plugins = detected.plugins;
  updatePackageScripts = detected.updatePackageScripts;
}
```

Note: destructure `plugins` and `updatePackageScripts` as `let` variables before this block since the current code uses `const { plugins, updatePackageScripts }`.

**Step 6: Suppress output.log/output.warn in agent mode and emit success**

Wrap the existing `output.warn` and `output.log` calls (lines 281-389) with `if (!aiMode)` guards.

After the existing final `output.log` block (line 389), before the function ends, add:

```typescript
if (aiMode) {
  const warnings: ImportWarning[] = [];

  if (packageManager !== sourcePackageManager) {
    warnings.push({
      type: 'package_manager_mismatch',
      message: `Source uses ${sourcePackageManager}, workspace uses ${packageManager}`,
      hint: 'Check for package.json feature discrepancies',
    });
  }
  if (source !== destination) {
    warnings.push({
      type: 'config_path_mismatch',
      message: `Source directory (${source}) differs from destination (${destination})`,
      hint: 'Update relative paths in configuration files (tsconfig.json, project.json, etc.)',
    });
  }
  if (ref) {
    warnings.push({
      type: 'missing_root_deps',
      message: 'Root dependencies and devDependencies are not imported',
      hint: 'Manually add required dependencies from the source repository',
    });
  }
  if (!installed) {
    warnings.push({
      type: 'install_failed',
      message: 'Package installation failed after import',
      hint: `Run "${pmc.install}" manually to resolve`,
    });
  }

  writeAiOutput(
    buildImportSuccessResult({
      sourceRepository,
      ref,
      source: source || '.',
      destination,
      pluginsInstalled: plugins.filter(() => installed),
      warnings: warnings.length > 0 ? warnings : undefined,
    })
  );
}
```

**Step 7: Verify it compiles**

Run: `npx nx run-many -t build,lint -p nx`
Expected: PASS

**Step 8: Commit**

```bash
git add packages/nx/src/command-line/import/import.ts
git commit -m "feat(core): add AI agent mode to nx import with NDJSON output"
```

---

### Task 5: Unit tests for import AI output builders

**Files:**

- Create: `packages/nx/src/command-line/import/utils/ai-output.spec.ts`

**Step 1: Write tests for builder functions**

```typescript
import {
  buildImportNeedsOptionsResult,
  buildImportNeedsPluginsResult,
  buildImportSuccessResult,
  buildImportErrorResult,
  determineImportErrorCode,
  getImportErrorHints,
} from './ai-output';

describe('import ai-output', () => {
  describe('buildImportNeedsOptionsResult', () => {
    it('should list missing fields and all available options', () => {
      const result = buildImportNeedsOptionsResult(['ref', 'destination']);
      expect(result.stage).toBe('needs_input');
      expect(result.success).toBe(false);
      expect(result.inputType).toBe('import_options');
      expect(result.missingFields).toEqual(['ref', 'destination']);
      expect(Object.keys(result.availableOptions)).toEqual([
        'sourceRepository',
        'ref',
        'source',
        'destination',
      ]);
      expect(result.availableOptions.source.required).toBe(false);
      expect(result.availableOptions.ref.required).toBe(true);
    });

    it('should include source repo in example command when provided', () => {
      const result = buildImportNeedsOptionsResult(
        ['ref'],
        'https://github.com/org/repo'
      );
      expect(result.exampleCommand).toContain('https://github.com/org/repo');
    });
  });

  describe('buildImportNeedsPluginsResult', () => {
    it('should list detected plugins with options', () => {
      const result = buildImportNeedsPluginsResult(
        [{ name: '@nx/vite', reason: 'Found vite' }],
        'nx import repo dest --ref main'
      );
      expect(result.inputType).toBe('plugins');
      expect(result.detectedPlugins).toHaveLength(1);
      expect(result.options).toContain('--plugins=skip');
      expect(result.options).toContain('--plugins=all');
      expect(result.options).toContain('--plugins=@nx/vite');
    });
  });

  describe('buildImportSuccessResult', () => {
    it('should include import details and next steps', () => {
      const result = buildImportSuccessResult({
        sourceRepository: 'https://github.com/org/repo',
        ref: 'main',
        source: 'apps/my-app',
        destination: 'apps/my-app',
        pluginsInstalled: ['@nx/vite'],
      });
      expect(result.stage).toBe('complete');
      expect(result.success).toBe(true);
      expect(result.result.sourceRepository).toBe(
        'https://github.com/org/repo'
      );
      expect(result.result.pluginsInstalled).toEqual(['@nx/vite']);
      expect(result.userNextSteps.steps.length).toBeGreaterThan(0);
    });

    it('should include warnings when provided', () => {
      const result = buildImportSuccessResult({
        sourceRepository: 'repo',
        ref: 'main',
        source: '.',
        destination: 'apps/dest',
        pluginsInstalled: [],
        warnings: [
          {
            type: 'package_manager_mismatch',
            message: 'Source uses yarn, workspace uses pnpm',
            hint: 'Check features',
          },
        ],
      });
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('package_manager_mismatch');
    });
  });

  describe('buildImportErrorResult', () => {
    it('should include error code and hints', () => {
      const result = buildImportErrorResult(
        'Clone failed',
        'CLONE_FAILED',
        '/tmp/error.log'
      );
      expect(result.stage).toBe('error');
      expect(result.errorCode).toBe('CLONE_FAILED');
      expect(result.hints.length).toBeGreaterThan(0);
      expect(result.errorLogPath).toBe('/tmp/error.log');
    });
  });

  describe('determineImportErrorCode', () => {
    it('should map error messages to correct codes', () => {
      expect(
        determineImportErrorCode(new Error('You have uncommitted changes'))
      ).toBe('UNCOMMITTED_CHANGES');
      expect(determineImportErrorCode(new Error('Failed to clone repo'))).toBe(
        'CLONE_FAILED'
      );
      expect(
        determineImportErrorCode(
          new Error('source directory does not exist in repo')
        )
      ).toBe('SOURCE_NOT_FOUND');
      expect(
        determineImportErrorCode(
          new Error('Destination directory is not empty')
        )
      ).toBe('DESTINATION_NOT_EMPTY');
      expect(determineImportErrorCode(new Error('Something unexpected'))).toBe(
        'UNKNOWN'
      );
    });
  });

  describe('getImportErrorHints', () => {
    it('should return hints for each error code', () => {
      const codes = [
        'UNCOMMITTED_CHANGES',
        'CLONE_FAILED',
        'SOURCE_NOT_FOUND',
        'DESTINATION_NOT_EMPTY',
        'INVALID_DESTINATION',
        'FILTER_FAILED',
        'MERGE_FAILED',
        'PACKAGE_INSTALL_ERROR',
        'PLUGIN_INIT_ERROR',
        'UNKNOWN',
      ] as const;
      for (const code of codes) {
        expect(getImportErrorHints(code).length).toBeGreaterThan(0);
      }
    });
  });
});
```

**Step 2: Run the tests**

Run: `npx nx test nx --testPathPattern=command-line/import/utils/ai-output`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/nx/src/command-line/import/utils/ai-output.spec.ts
git commit -m "test(core): add unit tests for import AI output builders"
```

---

### Task 6: Unit tests for shared AI output base module

**Files:**

- Create: `packages/nx/src/command-line/ai/ai-output.spec.ts`

**Step 1: Write tests for shared utilities**

```typescript
import { writeAiOutput, logProgress, writeErrorLog } from './ai-output';

// Mock isAiAgent
jest.mock('../../native', () => ({
  isAiAgent: jest.fn(),
}));

import { isAiAgent } from '../../native';
const mockIsAiAgent = isAiAgent as jest.MockedFunction<typeof isAiAgent>;

describe('shared ai-output', () => {
  let stdoutSpy: jest.SpyInstance;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation();
    mockIsAiAgent.mockReturnValue(false);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    jest.restoreAllMocks();
  });

  describe('writeAiOutput', () => {
    it('should write NDJSON when isAiAgent is true', () => {
      mockIsAiAgent.mockReturnValue(true);
      writeAiOutput({ stage: 'starting', message: 'test' });
      expect(stdoutSpy).toHaveBeenCalledWith(
        JSON.stringify({ stage: 'starting', message: 'test' }) + '\n'
      );
    });

    it('should not write when isAiAgent is false', () => {
      mockIsAiAgent.mockReturnValue(false);
      writeAiOutput({ stage: 'starting', message: 'test' });
      expect(stdoutSpy).not.toHaveBeenCalled();
    });

    it('should append USER_NEXT_STEPS for success results', () => {
      mockIsAiAgent.mockReturnValue(true);
      writeAiOutput({
        stage: 'complete',
        success: true,
        userNextSteps: {
          steps: [{ title: 'Run tests', command: 'nx test' }],
        },
      });
      // First call: JSON line, second call: plain text
      expect(stdoutSpy).toHaveBeenCalledTimes(2);
      const plainText = stdoutSpy.mock.calls[1][0];
      expect(plainText).toContain('---USER_NEXT_STEPS---');
      expect(plainText).toContain('Run tests');
    });
  });

  describe('logProgress', () => {
    it('should call writeAiOutput with stage and message', () => {
      mockIsAiAgent.mockReturnValue(true);
      logProgress('cloning', 'Cloning repo...');
      expect(stdoutSpy).toHaveBeenCalledWith(
        JSON.stringify({ stage: 'cloning', message: 'Cloning repo...' }) + '\n'
      );
    });
  });

  describe('writeErrorLog', () => {
    it('should write error details to temp file and return path', () => {
      const path = writeErrorLog(new Error('test error'), 'nx-import');
      expect(path).toContain('nx-import-error-');
      expect(path).toMatch(/\.log$/);
    });

    it('should handle non-Error objects', () => {
      const path = writeErrorLog('string error', 'nx');
      expect(path).toBeTruthy();
    });
  });
});
```

**Step 2: Run the tests**

Run: `npx nx test nx --testPathPattern=command-line/ai/ai-output`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/nx/src/command-line/ai/ai-output.spec.ts
git commit -m "test(core): add unit tests for shared AI output base module"
```

---

### Task 7: E2E tests for import agent mode

**Files:**

- Create: `e2e/nx/src/import-ai-agent.test.ts`

**Step 1: Write the e2e test file**

This mirrors the structure of `e2e/nx/src/import.test.ts` but sets `CLAUDECODE=1` in the env and asserts on NDJSON output.

```typescript
import {
  checkFilesExist,
  cleanupProject,
  getSelectedPackageManager,
  newProject,
  runCLI,
  runCommand,
  e2eCwd,
  readJson,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { writeFileSync, mkdirSync, rmdirSync } from 'fs';
import { execSync } from 'node:child_process';
import { join } from 'path';

/**
 * Parse NDJSON output from agent-mode nx commands.
 * Splits stdout on newlines, parses each JSON line,
 * filters out USER_NEXT_STEPS plain text section.
 */
function parseNdjsonOutput(stdout: string): Record<string, any>[] {
  return stdout
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      // Skip the USER_NEXT_STEPS plain text section
      if (trimmed.startsWith('---') || trimmed.startsWith('[DISPLAY]'))
        return false;
      // Must be JSON (starts with {)
      return trimmed.startsWith('{');
    })
    .map((line) => {
      try {
        return JSON.parse(line.trim());
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function findMessage(
  messages: Record<string, any>[],
  predicate: (msg: Record<string, any>) => boolean
): Record<string, any> | undefined {
  return messages.find(predicate);
}

const agentEnv = { CLAUDECODE: '1' };

describe('Nx Import - AI Agent Mode', () => {
  let proj: string;
  const tempImportE2ERoot = join(e2eCwd, 'nx-import-ai');

  beforeAll(() => {
    proj = newProject({
      packages: ['@nx/js'],
    });

    if (getSelectedPackageManager() === 'pnpm') {
      updateFile('pnpm-workspace.yaml', `packages:\n  - 'projects/*'\n`);
    } else {
      updateJson('package.json', (json) => {
        json.workspaces = ['projects/*'];
        return json;
      });
    }

    try {
      rmdirSync(tempImportE2ERoot);
    } catch {}
  });

  beforeEach(() => {
    runCommand(`git add .`);
    runCommand(`git commit -am "Update" --allow-empty`);
  });

  afterAll(() => cleanupProject());

  /**
   * Helper: create a simple git repo with a README
   */
  function createSimpleRepo(name: string): string {
    const repoPath = join(tempImportE2ERoot, name);
    mkdirSync(repoPath, { recursive: true });
    writeFileSync(join(repoPath, 'README.md'), `# ${name}`);
    writeFileSync(
      join(repoPath, 'package.json'),
      JSON.stringify({ name, version: '1.0.0' }, null, 2)
    );
    execSync(`git init && git add . && git commit -m "initial commit"`, {
      cwd: repoPath,
    });
    try {
      execSync(`git checkout -b main`, { cwd: repoPath });
    } catch {}
    return repoPath;
  }

  /**
   * Helper: create a repo with a Vite app for plugin detection tests
   */
  function createViteRepo(): string {
    const name = 'vite-ai-test';
    mkdirSync(join(tempImportE2ERoot), { recursive: true });
    execSync(`npx create-vite@latest ${name} --template react-ts`, {
      cwd: tempImportE2ERoot,
    });
    const repoPath = join(tempImportE2ERoot, name);
    execSync(`git init && git add . && git commit -m "initial commit"`, {
      cwd: repoPath,
    });
    try {
      execSync(`git checkout -b main`, { cwd: repoPath });
    } catch {}
    return repoPath;
  }

  /**
   * Helper: create a repo with two packages
   */
  function createMultiPackageRepo(): string {
    const repoPath = join(tempImportE2ERoot, 'multi-pkg');
    mkdirSync(repoPath, { recursive: true });
    writeFileSync(join(repoPath, 'README.md'), '# Repo');
    execSync(`git init && git add . && git commit -m "initial"`, {
      cwd: repoPath,
    });
    try {
      execSync(`git checkout -b main`, { cwd: repoPath });
    } catch {}

    mkdirSync(join(repoPath, 'packages/a'), { recursive: true });
    writeFileSync(join(repoPath, 'packages/a/README.md'), '# A');
    writeFileSync(
      join(repoPath, 'packages/a/package.json'),
      JSON.stringify({ name: 'pkg-a', version: '1.0.0' }, null, 2)
    );
    execSync(`git add . && git commit -m "add package a"`, { cwd: repoPath });

    mkdirSync(join(repoPath, 'packages/b'), { recursive: true });
    writeFileSync(join(repoPath, 'packages/b/README.md'), '# B');
    writeFileSync(
      join(repoPath, 'packages/b/package.json'),
      JSON.stringify({ name: 'pkg-b', version: '1.0.0' }, null, 2)
    );
    execSync(`git add . && git commit -m "add package b"`, { cwd: repoPath });

    return repoPath;
  }

  describe('needs_input for missing arguments', () => {
    it('should return needs_input when destination is missing', () => {
      const repoPath = createSimpleRepo('needs-input-test');
      const output = runCLI(`import ${repoPath} --ref main`, {
        silenceError: true,
        env: agentEnv,
      });
      const messages = parseNdjsonOutput(output);
      const needsInput = findMessage(
        messages,
        (m) => m.stage === 'needs_input' && m.inputType === 'import_options'
      );
      expect(needsInput).toBeDefined();
      expect(needsInput.missingFields).toContain('destination');
      expect(needsInput.availableOptions).toHaveProperty('sourceRepository');
      expect(needsInput.availableOptions).toHaveProperty('ref');
      expect(needsInput.availableOptions).toHaveProperty('source');
      expect(needsInput.availableOptions).toHaveProperty('destination');
      expect(needsInput.availableOptions.source.required).toBe(false);
    });

    it('should return needs_input when multiple fields are missing', () => {
      const output = runCLI(`import https://github.com/test/repo`, {
        silenceError: true,
        env: agentEnv,
      });
      const messages = parseNdjsonOutput(output);
      const needsInput = findMessage(
        messages,
        (m) => m.stage === 'needs_input' && m.inputType === 'import_options'
      );
      expect(needsInput).toBeDefined();
      expect(needsInput.missingFields).toContain('ref');
      expect(needsInput.missingFields).toContain('destination');
    });
  });

  describe('full import with agent mode', () => {
    it('should emit progress and needs_input for plugins when --plugins not provided', () => {
      const repoPath = createViteRepo();
      const output = runCLI(
        `import ${repoPath} projects/vite-ai --ref main --source . --plugins skip`,
        { verbose: true, env: agentEnv }
      );
      const messages = parseNdjsonOutput(output);

      // Check progress stages
      expect(
        findMessage(messages, (m) => m.stage === 'starting')
      ).toBeDefined();
      expect(findMessage(messages, (m) => m.stage === 'cloning')).toBeDefined();
      expect(
        findMessage(messages, (m) => m.stage === 'complete')
      ).toBeDefined();

      // Files should be imported
      checkFilesExist(
        'projects/vite-ai/package.json',
        'projects/vite-ai/index.html',
        'projects/vite-ai/vite.config.ts'
      );
    });

    it('should complete successfully with --plugins=skip', () => {
      const repoPath = createSimpleRepo('plugins-skip-test');
      const output = runCLI(
        `import ${repoPath} projects/skip-test --ref main --source . --plugins skip`,
        { verbose: true, env: agentEnv }
      );
      const messages = parseNdjsonOutput(output);
      const success = findMessage(
        messages,
        (m) => m.stage === 'complete' && m.success === true
      );
      expect(success).toBeDefined();
      expect(success.result.pluginsInstalled).toEqual([]);
      expect(success.result.destination).toBe('projects/skip-test');

      checkFilesExist(
        'projects/skip-test/README.md',
        'projects/skip-test/package.json'
      );
    });
  });

  describe('import subdirectory', () => {
    it('should import a subdirectory with correct paths in output', () => {
      const repoPath = createMultiPackageRepo();
      const output = runCLI(
        `import ${repoPath} packages/a --ref main --source packages/a --plugins skip`,
        { verbose: true, env: agentEnv }
      );
      const messages = parseNdjsonOutput(output);
      const success = findMessage(
        messages,
        (m) => m.stage === 'complete' && m.success === true
      );
      expect(success).toBeDefined();
      expect(success.result.source).toBe('packages/a');
      expect(success.result.destination).toBe('packages/a');

      checkFilesExist('packages/a/README.md');
    });
  });

  describe('error cases', () => {
    it('should return structured error for non-empty destination', () => {
      const repoPath = createSimpleRepo('error-nonempty-test');

      // First import to populate destination
      runCLI(
        `import ${repoPath} projects/error-dest --ref main --source . --plugins skip`,
        { verbose: true, env: agentEnv }
      );
      runCommand(`git add . && git commit -am "first import"`);

      // Second import to same destination should fail
      const output = runCLI(
        `import ${repoPath} projects/error-dest --ref main --source . --plugins skip`,
        { silenceError: true, env: agentEnv }
      );
      const messages = parseNdjsonOutput(output);
      const error = findMessage(messages, (m) => m.stage === 'error');
      expect(error).toBeDefined();
      expect(error.errorCode).toBe('DESTINATION_NOT_EMPTY');
      expect(error.hints.length).toBeGreaterThan(0);
    });
  });
});
```

**Step 2: Run the e2e tests**

Run: `npx nx e2e-local e2e-nx -- --testPathPattern=import-ai-agent`
Expected: PASS (this will take a while — e2e tests clone real repos)

Note: If this test runner command doesn't match exactly, check the e2e project configuration with `nx show project e2e-nx` to find the correct e2e target.

**Step 3: Commit**

```bash
git add e2e/nx/src/import-ai-agent.test.ts
git commit -m "test(core): add e2e tests for nx import AI agent mode"
```

---

### Task 8: Format and final validation

**Step 1: Format all changed files**

```bash
npx prettier --write packages/nx/src/command-line/ai/ai-output.ts packages/nx/src/command-line/ai/ai-output.spec.ts packages/nx/src/command-line/init/utils/ai-output.ts packages/nx/src/command-line/import/utils/ai-output.ts packages/nx/src/command-line/import/utils/ai-output.spec.ts packages/nx/src/command-line/import/import.ts packages/nx/src/command-line/import/command-object.ts e2e/nx/src/import-ai-agent.test.ts
```

**Step 2: Run full affected validation**

```bash
nx affected -t build,test,lint
```

Expected: PASS

**Step 3: Amend if formatting changes**

```bash
git add -A && git commit --amend --no-edit
```

**Step 4: Run prepush**

```bash
nx prepush
```

Expected: PASS
