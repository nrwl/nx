import { coerce } from 'semver';
import { customDimensions, reportEvent } from '../../analytics';
import { ProvenanceError } from '../../utils/provenance';
import { workspaceRoot } from '../../utils/workspace-root';
import type { MigrateInclude } from './command-object';

export type MigrateIncludeSource = 'flag' | 'nx-json' | 'prompt' | 'default';
export type MigrateMultiMajorChoice = 'gradual' | 'direct';
export type MigrateFetchFallbackReason =
  | 'env-skip'
  | 'unsupported-registry'
  | 'provenance'
  | 'registry-error';
// Accumulated by `createFetcher` across the migration cascade (one fetch per
// package) and folded into the single completion event - never reported
// per fetch. `fallbackReason` holds the first fallback hit.
export type MigrateFetchStats = {
  registryCount: number;
  installCount: number;
  fallbackReason?: MigrateFetchFallbackReason;
};
// Mirrors `ResolvedAgentic['kind']`; kept local to avoid importing agentic
// types into the analytics module (which agentic/* already imports from).
export type MigrateAgenticOutcome = 'enabled' | 'disabled' | 'inside-agent';
// Underscore-shaped because the prompt name is appended verbatim to the
// `migrate_prompt_` event name.
export type MigratePromptName =
  | 'include'
  | 'multi_major'
  | 'agentic'
  | 'agent_select'
  | 'ambiguous_agent_outcome';
export type MigrateGenerateErrorCode =
  | 'version-resolution'
  | 'fetch-migrations'
  | 'package-updates';
export type MigrateRunErrorCode =
  | 'npm-install'
  | 'migration-exec'
  | 'agentic'
  | 'other';

// Identifier-shaped tokens only (Node codes like ENOENT, class names like
// TypeError). Rejects anything with a slash, space, or punctuation so a
// settable `.code`/`.name` can't smuggle a path or message into GA.
const IDENTIFIER_SHAPE = /^[A-Za-z][A-Za-z0-9_]*$/;

// Context collected across the flow and folded into the completion/error
// events. `_migrate` executes a single migrate invocation per process, so
// module state is safe.
let resolvedInclude: MigrateInclude | undefined;
let includeSource: MigrateIncludeSource | undefined;
let generateErrorRecorded = false;
let runErrorRecorded = false;
let runStarted = false;

export function setMigrateInclude(include: MigrateInclude): void {
  resolvedInclude = include;
}

export function setMigrateIncludeSource(source: MigrateIncludeSource): void {
  includeSource = source;
}

export function classifyMigrateFetchFallback(
  error: unknown
): MigrateFetchFallbackReason {
  if (error instanceof ProvenanceError) {
    return 'provenance';
  }
  if (
    error instanceof Error &&
    error.message.includes('is not supported from')
  ) {
    return 'unsupported-registry';
  }
  return 'registry-error';
}

/**
 * Records an interactive migrate prompt and the user's selection.
 *
 * The prompt identity is encoded in the event name (`migrate_prompt_<prompt>`)
 * so it doesn't cost a GA custom dimension; `choice` is one dimension
 * multiplexed across all prompts, read conditioned on the event name.
 * Per-prompt `choice` value-spaces:
 * - `include`: `required` | `optional` | `all` (the resolved MigrateInclude).
 * - `multi_major`: `direct` | `latest-in-current` | `latest-in-next` - the raw
 *   3-way selection. The `multi_major_choice` outcome dim deliberately collapses
 *   this to the 2-way semantic (`gradual` | `direct`); the variant survives only
 *   here.
 * - `agentic`: `yes-flex` | `yes-pin` (multi-agent only) | `no-once` | `no-never`.
 * - `agent_select`: the chosen agent id (open-ended).
 * - `ambiguous_agent_outcome`: `abort` | `continue`.
 */
export function reportMigratePrompt(
  prompt: MigratePromptName,
  choice: string
): void {
  safeReport(() => {
    if (!customDimensions) return;
    reportEvent(`migrate_prompt_${prompt}`, {
      [customDimensions.choice]: choice,
    });
  });
}

export function reportMigrateGenerateStart(opts: {
  targetPackage: string;
  interactive?: boolean;
  excludeAppliedMigrations?: boolean;
}): void {
  safeReport(() => {
    if (!customDimensions) return;
    reportEvent('migrate_generate_start', {
      // Resolved migration target (defaults to `nx`; only an explicit
      // non-first-party target is third-party). Reported raw per the `nx add`
      // precedent - it's the chosen target, not a transitive dep like
      // `run_error`'s `migration_name`, so there's no dependency-graph leak.
      [customDimensions.packageName]: opts.targetPackage,
      [customDimensions.cliSource]: cliSource(),
      [customDimensions.interactive]: opts.interactive,
      [customDimensions.excludeAppliedMigrations]:
        opts.excludeAppliedMigrations,
    });
  });
}

export function reportMigrateGenerateComplete(opts: {
  targetVersion: string;
  // The original full target when multi-major redirected to a smaller step.
  requestedTargetVersion: string;
  installedTargetVersion: string | null | undefined;
  include: MigrateInclude;
  multiMajorChoice?: MigrateMultiMajorChoice;
  // Absent when the fetcher was injected (tests) rather than `createFetcher`'s.
  fetchStats?: MigrateFetchStats;
}): void {
  safeReport(() => {
    if (!customDimensions) return;
    const majorsCrossed = computeMajorsCrossed(
      opts.installedTargetVersion,
      opts.requestedTargetVersion
    );
    const { registryCount = 0, installCount = 0 } = opts.fetchStats ?? {};
    const fetchMethod =
      registryCount > 0 && installCount > 0
        ? 'mixed'
        : installCount > 0
          ? 'install'
          : registryCount > 0
            ? 'registry'
            : undefined;
    reportEvent('migrate_generate_complete', {
      [customDimensions.packageVersion]: opts.targetVersion,
      [customDimensions.include]: opts.include,
      [customDimensions.includeSource]: includeSource,
      [customDimensions.majorsCrossed]: majorsCrossed,
      // Only meaningful when the multi-major gate (2+ majors) applied.
      ...(majorsCrossed !== undefined &&
      majorsCrossed >= 2 &&
      opts.multiMajorChoice
        ? { [customDimensions.multiMajorChoice]: opts.multiMajorChoice }
        : {}),
      [customDimensions.fetchMethod]: fetchMethod,
      [customDimensions.fetchFallbackReason]: opts.fetchStats?.fallbackReason,
    });
  });
}

export function reportMigrateGenerateError(
  code: MigrateGenerateErrorCode,
  error: unknown
): void {
  safeReport(() => {
    if (!customDimensions || generateErrorRecorded) return;
    generateErrorRecorded = true;
    reportEvent('migrate_generate_error', {
      [customDimensions.errorCode]: code,
      // Populated only when the failure occurred after include resolution; the
      // earliest (version-resolution) failures leave these undefined.
      [customDimensions.include]: resolvedInclude,
      [customDimensions.includeSource]: includeSource,
      [customDimensions.errorName]: errorName(error),
      [customDimensions.errorLocation]: errorLocation(error),
    });
  });
}

export function reportMigrateRunStart(opts: {
  createCommits: boolean;
  migrationCount: number;
}): void {
  safeReport(() => {
    if (!customDimensions) return;
    runStarted = true;
    // No cli_source here: the run phase always executes from the local
    // installation (the temp-install process re-dispatches before this point).
    reportEvent('migrate_run_start', {
      [customDimensions.createCommits]: opts.createCommits,
      [customDimensions.migrationCount]: opts.migrationCount,
    });
  });
}

/**
 * Whether the current process recorded a `migrate_run_start` event. Lets
 * shared code paths (e.g. `executeMigrations`, reused by `nx repair`) skip
 * migrate events when not running inside a migrate run.
 */
export function hasMigrateRunStarted(): boolean {
  return runStarted;
}

export function reportMigrateRunComplete(opts: {
  // `inside-agent` (outer agent drives the run) and `disabled` (opted out) are
  // distinct outcomes the old boolean collapsed together.
  agenticOutcome: MigrateAgenticOutcome;
  agentUsed?: string;
  migrationCount: number;
  // Fully-completed migrations (excludes deferred prompt-halves); mirrors the
  // user-facing tally so the metric matches what the run printed.
  appliedCount: number;
}): void {
  safeReport(() => {
    if (!customDimensions) return;
    reportEvent('migrate_run_complete', {
      [customDimensions.agenticOutcome]: opts.agenticOutcome,
      [customDimensions.agentUsed]: opts.agentUsed,
      [customDimensions.migrationCount]: opts.migrationCount,
      [customDimensions.appliedCount]: opts.appliedCount,
    });
  });
}

export function reportMigrateRunError(opts: {
  code: MigrateRunErrorCode;
  migrationPackage?: string;
  migrationName?: string;
  // Position of the failing migration within the run. Set only at the in-loop
  // failure site; the agentic-resolve and outer-install sites leave them unset.
  migrationIndex?: number;
  migrationCount?: number;
  error?: unknown;
}): void {
  safeReport(() => {
    if (!customDimensions || runErrorRecorded) return;
    runErrorRecorded = true;
    reportEvent('migrate_run_error', {
      [customDimensions.errorCode]: opts.code,
      // Third-party migration names can reveal private packages; only report
      // first-party ones.
      ...(opts.migrationPackage &&
      opts.migrationName &&
      isFirstPartyMigrationPackage(opts.migrationPackage)
        ? {
            [customDimensions.migrationName]: `${opts.migrationPackage}:${opts.migrationName}`,
          }
        : {}),
      [customDimensions.migrationIndex]: opts.migrationIndex,
      [customDimensions.migrationCount]: opts.migrationCount,
      [customDimensions.errorName]:
        opts.error !== undefined ? errorName(opts.error) : undefined,
      [customDimensions.errorLocation]:
        opts.error !== undefined ? errorLocation(opts.error) : undefined,
    });
  });
}

// `_migrate` runs either from a temp install of the latest CLI or from the
// workspace-local installation; same signal as the run-phase re-dispatch
// check in migrate.ts.
function cliSource(): 'local' | 'temp-latest' {
  return __dirname.startsWith(workspaceRoot) ? 'local' : 'temp-latest';
}

// `coerce` tolerates ranges and partial versions from package.json entries
// (e.g. `^21.0.0`); dist-tags that never resolved coerce to null.
export function computeMajorsCrossed(
  installed: string | null | undefined,
  target: string | null | undefined
): number | undefined {
  const installedVersion = installed ? coerce(installed) : null;
  const targetVersion = target ? coerce(target) : null;
  if (!installedVersion || !targetVersion) {
    return undefined;
  }
  return Math.max(0, targetVersion.major - installedVersion.major);
}

function isFirstPartyMigrationPackage(packageName: string): boolean {
  return (
    packageName === 'nx' ||
    packageName.startsWith('@nx/') ||
    packageName.startsWith('@nrwl/')
  );
}

// Structured error identity instead of the raw message: a Node system `code`
// (ENOENT, ETIMEDOUT), else the constructor name (TypeError, ProvenanceError),
// else the bare type. `.code`/`.name` are settable, so a migration could stuff
// a path or message into them - only accept identifier-shaped tokens and fall
// back to the bare type, so no free text reaches GA.
function errorName(error: unknown): string {
  const code = (error as { code?: unknown })?.code;
  if (typeof code === 'string' && IDENTIFIER_SHAPE.test(code)) {
    return code;
  }
  if (error instanceof Error && IDENTIFIER_SHAPE.test(error.name)) {
    return error.name;
  }
  return typeof error;
}

// Topmost stack frame inside a first-party package (nx, @nx/*, @nrwl/*),
// package-qualified and relative to the package root (e.g.
// `nx/src/command-line/migrate/migrate.js:1830:18`). The absolute prefix and
// `dist/` are stripped so no user path leaks, and non-first-party frames are
// skipped so a failing third-party migration can't surface a private package
// path. Caveats: the topmost first-party frame may be a dispatcher rather than
// the exact throw site, and (no shipped sourcemaps) the line:col is in the
// compiled JS - so this locates against `nx_version`, not the TS source.
function errorLocation(error: unknown): string | undefined {
  if (!(error instanceof Error) || !error.stack) return undefined;
  for (const line of error.stack.split('\n')) {
    const match = line
      .replace(/\\/g, '/')
      .match(
        /\/node_modules\/((?:@(?:nx|nrwl)\/[^/]+|nx))\/(?:dist\/)?(src\/.+?:\d+:\d+)/
      );
    if (match) return `${match[1]}/${match[2]}`;
  }
  return undefined;
}

// Analytics is a secondary concern and must never interfere with the migrate
// run. Swallow any failure while building params or emitting the event
// (surfaced only under verbose logging), mirroring `trackEvent`/`flushAnalytics`
// in `../../analytics`.
function safeReport(emit: () => void): void {
  try {
    emit();
  } catch (e) {
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.log(
        `Failed to record migrate analytics event: ${
          e instanceof Error ? e.message : e
        }`
      );
    }
  }
}
