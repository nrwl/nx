# Nx OTEL Telemetry Implementation Plan

## Overview

Add OpenTelemetry-based telemetry to Nx for collecting anonymous usage data. The implementation prioritizes performance (fire-and-forget pattern), privacy (comprehensive sanitization), and user control (opt-in with multiple override levels).

## Key Decisions

| Decision      | Choice                                             |
| ------------- | -------------------------------------------------- |
| Architecture  | Simple helper functions (no provider abstraction)  |
| Exporter      | JS worker thread                                   |
| User storage  | `~/.nxrc` (JSON with namespace)                    |
| Repo storage  | `nx.json` telemetry section                        |
| CI behavior   | Auto opt-in unless repo explicitly opts out        |
| Prompt timing | First nx command (local interactive only)          |
| OTLP endpoint | Default Nx Cloud + optional custom endpoint        |
| Project names | Anonymized placeholders (`project-1`, `project-2`) |

## Settings Resolution Order

```
1. Environment Variables (highest priority)
   - NX_TELEMETRY=true/false
   - NX_OTLP_ENDPOINT=https://...

2. Repo Config (nx.json)
   { "telemetry": { "enabled": true/false, "customEndpoint": "..." } }

3. User Config (~/.nxrc) - local runs only
   { "telemetry": { "enabled": true/false, "customEndpoint": "..." } }

4. Defaults
   - CI: enabled = true
   - Local interactive + not prompted: prompt user
   - Local non-interactive: enabled = false
```

## Data Collected

### Command Invocations

- Command name, sanitized args, duration, success/failure
- Platform, arch, Node version, Nx version
- isCI, CI provider, hasNxCloud
- Workspace metadata (project count, known plugins, custom plugin count)

### Task Executions (non-continuous only)

- Anonymized project reference, target name (standard or `[custom]`)
- Duration, status, cache status (local-hit, remote-hit, miss, disabled)

### Errors

- Error type/class name, phase
- Sanitized stack trace (node_modules paths kept, user paths redacted)

---

## Implementation Steps

### Phase 1: Core Infrastructure

#### 1.1 Create Telemetry Types

**File**: `packages/nx/src/utils/telemetry/types.ts`

```typescript
export interface TelemetrySettings {
  enabled?: boolean;
  customEndpoint?: string;
}

export interface CommandTelemetryEvent {
  command: string;
  sanitizedArgs: SanitizedArgs;
  durationMs: number;
  success: boolean;
  platform: string;
  arch: string;
  nodeVersion: string;
  nxVersion: string;
  isCI: boolean;
  ciProvider?: string;
  hasNxCloud: boolean;
  workspaceMetadata: WorkspaceMetadata;
}

export interface TaskExecutionEvent {
  project: string; // anonymized
  target: string;
  durationMs: number;
  status: 'success' | 'failure' | 'skipped';
  cacheStatus: 'local-hit' | 'remote-hit' | 'miss' | 'disabled';
}

export interface ErrorEvent {
  errorType: string;
  phase: string;
  sanitizedStack?: string;
  command: string;
}
```

#### 1.2 Create User Settings Storage

**File**: `packages/nx/src/utils/telemetry/user-settings.ts`

- Read/write `~/.nxrc` (JSON format)
- Structure: `{ "telemetry": { "enabled": boolean, "customEndpoint": string } }`
- Create directory if needed, handle missing file gracefully

#### 1.3 Add Telemetry to NxJsonConfiguration

**File**: `packages/nx/src/config/nx-json.ts`

Add to `NxJsonConfiguration` interface:

```typescript
telemetry?: {
  enabled?: boolean;
  customEndpoint?: string;
};
```

#### 1.4 Create Settings Resolution

**File**: `packages/nx/src/utils/telemetry/resolve-settings.ts`

- Check `NX_TELEMETRY` env var
- Check `NX_OTLP_ENDPOINT` env var
- Read nx.json telemetry section
- Read ~/.nxrc telemetry section (non-CI only)
- Apply defaults based on environment

---

### Phase 2: Sanitization

#### 2.1 Core Sanitization Utilities

**File**: `packages/nx/src/utils/telemetry/sanitize.ts`

- `sanitizeArgs(argv)` - Sanitize CLI arguments
- `anonymizeProjectName(name, map)` - Deterministic placeholder mapping
- `sanitizeErrorMessage(message)` - Redact paths, packages, secrets
- `sanitizeStackTrace(stack)` - Keep node_modules, redact user paths

#### 2.2 Generator Args Allowlist

**File**: `packages/nx/src/utils/telemetry/generator-args.ts`

- Define safe args per known generator
- Categorize: `safeArgs`, `presenceOnlyArgs`, `categorizedArgs`
- Default spec for unknown @nx/\* generators

#### 2.3 Constants

**File**: `packages/nx/src/utils/telemetry/constants.ts`

```typescript
export const STANDARD_TARGETS = new Set([
  'build',
  'serve',
  'test',
  'lint',
  'e2e',
  'dev',
  'start',
  'preview',
  'deploy',
  'publish',
  'typecheck',
  'format',
]);

export const STANDARD_CONFIGS = new Set([
  'production',
  'development',
  'staging',
  'test',
  'ci',
]);

export const KNOWN_PLUGINS_PREFIX = ['@nx/', '@nrwl/'];
```

---

### Phase 3: Worker Thread Exporter

#### 3.1 Worker Implementation

**File**: `packages/nx/src/utils/telemetry/worker.ts`

- Receive events via `parentPort.on('message')`
- Buffer events (max 50 or 5 seconds)
- Export to OTLP endpoint(s) using `@opentelemetry/exporter-trace-otlp-http`
- Fire-and-forget (silent failures)
- Handle shutdown message for graceful flush

#### 3.2 Worker Manager

**File**: `packages/nx/src/utils/telemetry/exporter.ts`

- Lazy worker initialization
- `sendEvent(event)` - Post message to worker
- `flush()` - Signal worker to flush, wait briefly
- Handle worker errors gracefully

---

### Phase 4: Public API (Helper Functions)

#### 4.1 Main Entry Point

**File**: `packages/nx/src/utils/telemetry/index.ts`

```typescript
export function initTelemetry(workspaceRoot: string | null): void;
export function recordCommandStart(
  command: string,
  argv: string[]
): CommandContext;
export function recordCommandEnd(ctx: CommandContext, success: boolean): void;
export function recordTaskExecution(task: TaskExecutionEvent): void;
export function recordError(error: Error, phase: string, command: string): void;
export function flushTelemetry(): Promise<void>;
```

All functions check `isTelemetryEnabled()` first and no-op if disabled.

---

### Phase 5: Opt-in Prompt

#### 5.1 Prompt Implementation

**File**: `packages/nx/src/utils/telemetry/prompt.ts`

- Check if interactive (stdin.isTTY && stdout.isTTY && !isCI)
- Use `enquirer` for consistent UX (like nx-console-prompt)
- Save preference to `~/.nxrc`
- Display clear explanation of what's collected

---

### Phase 6: Integration Points

#### 6.1 CLI Entry Point

**File**: `packages/nx/bin/nx.ts`

- Import telemetry module
- Call `initTelemetry()` early (after workspace detection)
- Trigger prompt if needed (first run, interactive, local)
- Hook `process.on('exit')` for `flushTelemetry()`

#### 6.2 Command Execution

**File**: `packages/nx/src/command-line/nx-commands.ts` (or appropriate location)

- Wrap command execution with `recordCommandStart`/`recordCommandEnd`
- Pass sanitized context through

#### 6.3 Task Runner

**File**: `packages/nx/src/tasks-runner/` (identify exact file)

- Call `recordTaskExecution()` after each task completes
- Skip continuous tasks (serve, watch, etc.)

#### 6.4 Error Handling

**File**: Various error handling locations

- Call `recordError()` at top-level error boundaries
- Ensure sanitization before recording

---

### Phase 7: Schema Updates

#### 7.1 nx-schema.json

**File**: `packages/nx/schemas/nx-schema.json`

Add telemetry configuration schema matching the TypeScript interface.

---

## File Summary

### New Files

```
packages/nx/src/utils/telemetry/
├── index.ts              # Public API
├── types.ts              # TypeScript interfaces
├── constants.ts          # Standard targets, configs, plugins
├── resolve-settings.ts   # Settings resolution logic
├── user-settings.ts      # ~/.nxrc read/write
├── sanitize.ts           # Core sanitization functions
├── generator-args.ts     # Generator arg allowlists
├── prompt.ts             # Opt-in prompt
├── worker.ts             # Worker thread implementation
└── exporter.ts           # Worker manager
```

### Modified Files

```
packages/nx/bin/nx.ts                    # Init + flush hooks
packages/nx/src/config/nx-json.ts        # Add telemetry interface
packages/nx/schemas/nx-schema.json       # Add telemetry schema
packages/nx/src/command-line/nx-commands.ts  # Command recording
packages/nx/src/tasks-runner/*.ts        # Task execution recording
```

---

## Dependencies

### New npm Dependencies

```json
{
  "@opentelemetry/api": "^1.x",
  "@opentelemetry/sdk-trace-base": "^1.x",
  "@opentelemetry/exporter-trace-otlp-http": "^0.x"
}
```

---

## Testing Strategy

1. **Unit tests** for sanitization functions (most critical)
2. **Unit tests** for settings resolution logic
3. **Integration tests** with mock OTLP endpoint
4. **E2E test** verifying no telemetry when disabled

---

## Performance Considerations

- Worker thread isolates export from main thread
- Batching reduces HTTP overhead
- Fire-and-forget prevents blocking
- Lazy initialization (only when enabled)
- Settings cached after first resolution

---

## Privacy Checklist

- [ ] Project names anonymized
- [ ] User file paths never included
- [ ] Node_modules paths keep only from node_modules onward
- [ ] Custom executors/generators redacted
- [ ] Generator args follow allowlist
- [ ] Error messages sanitized
- [ ] No env var values captured
- [ ] No pass-through CLI args captured
- [ ] URLs have paths redacted
