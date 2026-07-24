import type { AgentId } from './cli-args';
export type { AgentId };

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
 * Result of the up-front resolution phase that runs once per run-phase
 * invocation (`--run-migrations` before its migration loop, `--run-migration`
 * before its single migration) and applies to every migration it covers.
 *
 * - `inside-agent`: nx detected it is itself running inside another agent;
 *   every agentic step is skipped and prompt migrations go to `nextSteps`.
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
