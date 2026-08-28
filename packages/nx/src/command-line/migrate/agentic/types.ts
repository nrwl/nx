import type { AgentId } from './cli-args';
export type { AgentId };

/**
 * Workspace-relative directory holding all migrate-run scratch: a run
 * directory per run id. Shared by the run-dir layout in `handoff.ts` and the
 * agent permission rules in `definitions.ts` so the pre-authorized write scope
 * can't drift from the actual layout. It lives here so `definitions.ts`,
 * loaded whenever the agentic flow is resolved, doesn't pull in the handoff
 * runtime for the path alone.
 */
export const MIGRATE_RUNS_RELATIVE_DIR = '.nx/migrate-runs';

/**
 * The one subtree of a run directory an agent writes: its handoff files.
 * Everything beside it is state Nx owns and reads back, the orchestrator's
 * run state and plan snapshots included, so the pre-authorized write scope
 * stops at this segment. Package names make up the rest of a handoff path,
 * so without it they would occupy the run directory's top level and leave Nx
 * no name it could add there safely.
 */
export const HANDOFFS_DIR_NAME = 'handoffs';

/**
 * Composite identity of the v23 migration that adds `.nx/migrate-runs` to
 * `.gitignore`. Hard-coded because the agentic preflight is a deliberate
 * one-off coupling: this exact migration owns the entry that keeps
 * `.nx/migrate-runs/<run-id>/...` scratch out of per-migration commits. If
 * the migration is ever renamed, this entry must move with it. It lives here
 * rather than in `handoff-gitignore.ts` so `sortMigrations`' hoist check
 * doesn't load that module's migration-execution machinery.
 */
const HANDOFF_GITIGNORE_MIGRATION_PACKAGE = 'nx';
const HANDOFF_GITIGNORE_MIGRATION_NAME =
  '23-0-0-add-migrate-runs-to-git-ignore';

export function isHandoffGitignoreMigration(m: {
  package: string;
  name: string;
}): boolean {
  return (
    m.package === HANDOFF_GITIGNORE_MIGRATION_PACKAGE &&
    m.name === HANDOFF_GITIGNORE_MIGRATION_NAME
  );
}

/**
 * A coding agent that was found on the user's machine, ready to be spawned.
 *
 * Produced by `detect-installed.ts`. The `binary` is an absolute path so the
 * runner can spawn it directly without re-resolving against PATH.
 */
export interface DetectedInstalledAgent {
  id: AgentId;
  displayName: string;
  binary: string;
  source: 'path' | 'well-known';
}

/**
 * Inputs the runner provides when asking an agent definition to build its
 * spawn arguments. Kept minimal — agent-specific quirks (e.g. transient agent
 * name for OpenCode) are encoded inside the definition, not here.
 */
export interface InvocationContext {
  systemContext: string;
  userPrompt: string;
  workspaceRoot: string;
  /**
   * Name of the run directory under `MIGRATE_RUNS_RELATIVE_DIR` holding this
   * invocation's handoff. A workspace can carry several run directories at
   * once, so a definition that pre-authorizes the handoff write narrows it to
   * this one: the others belong to runs this invocation is not executing.
   */
  runDirName: string;
}

/**
 * What an agent definition returns from `buildInteractive`. The runner combines
 * this with the detected binary path to actually spawn.
 */
export interface InvocationSpec {
  args: string[];
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

/**
 * Static description of an agent the migrate command knows how to dispatch to.
 */
export interface AgentDefinition {
  id: AgentId;
  displayName: string;
  /** Binary names to probe via `which` (PATHEXT handled by `which` on Windows). */
  binaryNames: string[];
  /** Absolute paths to probe as a fallback when PATH lookup misses. */
  wellKnownPaths(): string[];
  buildInteractive(ctx: InvocationContext): InvocationSpec;
}

/**
 * Output of the agent's handoff file, written at the end of an agentic step.
 * The two locked fields drive the failure-handling matrix in the design doc;
 * extra fields are tolerated and surfaced via `extras`.
 */
export interface HandoffFile {
  status: 'success' | 'failed';
  summary: string;
  extras?: Record<string, unknown>;
}

/**
 * Outcome the runner reports back to the migrate orchestrator after a single
 * agentic step. The four kinds mirror the (a)/(b)/(c) matrix plus the user's
 * choice when (c) fires.
 *
 * `ambiguous-abort.causeSummary`: pre-rendered explanation lines. Populated
 * when Ctrl+C bypasses the ambiguous prompt (so the cause was never shown
 * inline) and forwarded so the caller can surface it. Omitted when the user
 * chose "abort" at the prompt — the cause was already shown there.
 */
export type HandoffOutcome =
  | { kind: 'success'; summary: string; extras?: Record<string, unknown> }
  | { kind: 'failed'; summary: string; extras?: Record<string, unknown> }
  | { kind: 'ambiguous-continue' }
  | { kind: 'ambiguous-abort'; causeSummary?: string[] };

/**
 * Result of the up-front resolution phase, run once per run-phase invocation
 * and applied to every migration it covers.
 *
 * - `inside-agent`: nx detected it is itself running inside another agent;
 *   every agentic step is skipped and prompt migrations are surfaced for the
 *   outer agent to apply.
 * - `disabled`: the user opted out (explicit `--agentic=false`, declined the
 *   up-front prompt, or non-TTY without the flag).
 * - `enabled`: the agentic flow runs and `selectedAgent` is the agent it
 *   dispatches to.
 */
export type ResolvedAgentic =
  | { kind: 'inside-agent' }
  | { kind: 'disabled' }
  | { kind: 'enabled'; selectedAgent: DetectedInstalledAgent };

/** The `enabled` variant, useful for narrowed function signatures. */
export type EnabledResolvedAgentic = Extract<
  ResolvedAgentic,
  { kind: 'enabled' }
>;
