/**
 * Telemetry type definitions for Nx anonymous usage data collection.
 */

/**
 * Telemetry settings that can be configured at user or repo level.
 */
export interface TelemetrySettings {
  /**
   * Enable or disable telemetry collection.
   */
  enabled?: boolean;
  /**
   * Optional custom OTLP endpoint for telemetry data.
   * When specified, telemetry is sent to both Nx Cloud and this endpoint.
   */
  customEndpoint?: string;
}

/**
 * Resolved telemetry settings after merging all configuration sources.
 */
export interface ResolvedTelemetrySettings {
  /**
   * Whether telemetry is enabled.
   */
  enabled: boolean;
  /**
   * OTLP endpoints to send telemetry to.
   * Includes default Nx Cloud endpoint plus any custom endpoint.
   */
  endpoints: string[];
  /**
   * The configuration source that determined the enabled state.
   */
  source: 'env' | 'repo' | 'user' | 'default';
}

/**
 * A sanitized value that is safe to include in telemetry.
 */
export type SanitizedValue = boolean | number | string | '[REDACTED]';

/**
 * Sanitized command-line arguments safe for telemetry.
 * All potentially sensitive values are redacted.
 */
export interface SanitizedArgs {
  /**
   * Positional arguments (command names, standard targets, etc.)
   */
  positional: string[];
  /**
   * Flag values with sensitive data redacted.
   */
  flags: Record<string, SanitizedValue>;
}

/**
 * Anonymous workspace metadata for telemetry.
 * No project names or paths are included.
 */
export interface WorkspaceMetadata {
  /**
   * Total number of projects in the workspace.
   */
  projectCount: number;
  /**
   * List of known Nx plugins (@nx/* and @nrwl/*).
   */
  knownPlugins: string[];
  /**
   * Count of custom (non-Nx) plugins without exposing their names.
   */
  customPluginCount: number;
}

/**
 * Telemetry event for command invocations.
 */
export interface CommandTelemetryEvent {
  /**
   * The command name (e.g., 'build', 'test', 'generate').
   */
  command: string;
  /**
   * Sanitized command-line arguments.
   */
  sanitizedArgs: SanitizedArgs;
  /**
   * Command execution duration in milliseconds.
   */
  durationMs: number;
  /**
   * Whether the command completed successfully.
   */
  success: boolean;
  /**
   * Operating system platform (e.g., 'darwin', 'linux', 'win32').
   */
  platform: string;
  /**
   * CPU architecture (e.g., 'x64', 'arm64').
   */
  arch: string;
  /**
   * Node.js version.
   */
  nodeVersion: string;
  /**
   * Nx version.
   */
  nxVersion: string;
  /**
   * Whether running in a CI environment.
   */
  isCI: boolean;
  /**
   * CI provider name if detected.
   */
  ciProvider?: string;
  /**
   * Whether the workspace has Nx Cloud configured.
   */
  hasNxCloud: boolean;
  /**
   * Anonymous workspace metadata.
   */
  workspaceMetadata: WorkspaceMetadata;
}

/**
 * Telemetry event for task executions (non-continuous tasks only).
 */
export interface TaskExecutionEvent {
  /**
   * Anonymized project reference (e.g., 'project-1', 'project-2').
   */
  project: string;
  /**
   * Target name. Standard targets are included as-is,
   * custom targets are reported as '[custom]'.
   */
  target: string;
  /**
   * Task execution duration in milliseconds.
   */
  durationMs: number;
  /**
   * Task completion status.
   */
  status: 'success' | 'failure' | 'skipped';
  /**
   * Cache status for the task.
   */
  cacheStatus: 'local-hit' | 'remote-hit' | 'miss' | 'disabled';
}

/**
 * Telemetry event for errors.
 */
export interface ErrorEvent {
  /**
   * Error type/class name (e.g., 'TypeError', 'ProjectGraphError').
   */
  errorType: string;
  /**
   * Phase where the error occurred (e.g., 'project-graph', 'task-execution').
   */
  phase: string;
  /**
   * Sanitized stack trace with user paths redacted.
   * Only node_modules paths are preserved.
   */
  sanitizedStack?: string;
  /**
   * Command that was running when the error occurred.
   */
  command: string;
}

/**
 * Context object for tracking command execution from start to end.
 */
export interface CommandContext {
  /**
   * The command being executed.
   */
  command: string;
  /**
   * Timestamp when the command started (from performance.now() or Date.now()).
   */
  startTime: number;
  /**
   * Sanitized arguments for the command.
   */
  sanitizedArgs: SanitizedArgs;
}
