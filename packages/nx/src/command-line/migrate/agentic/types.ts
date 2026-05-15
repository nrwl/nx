import type { AgentId } from './agent-ids';
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
 */
export type HandoffOutcome =
  | { kind: 'success'; summary: string; extras?: Record<string, unknown> }
  | { kind: 'failed'; summary: string; extras?: Record<string, unknown> }
  | { kind: 'ambiguous-continue' }
  | { kind: 'ambiguous-abort' };

/**
 * Result of the up-front resolution phase that runs once per `--run-migrations`
 * invocation, before the migration loop. Cached and consulted for every entry.
 */
export interface ResolvedAgentic {
  /**
   * True when nx detected it is itself running inside another agent (inception)
   * — all agentic steps are skipped and prompt migrations go to `nextSteps`.
   */
  skipAllAgentic: boolean;
  /**
   * True when the agentic flow should fire for eligible entries. Always false
   * when `skipAllAgentic` is true.
   */
  agenticEnabled: boolean;
  /** Picked agent for the run. Only present when `agenticEnabled` is true. */
  selectedAgent?: DetectedInstalledAgent;
}
