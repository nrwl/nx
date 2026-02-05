/**
 * Error codes for CNW errors.
 * These are used for telemetry and error tracking.
 */
export type CnwErrorCode =
  | 'DIRECTORY_EXISTS'
  | 'INVALID_WORKSPACE_NAME'
  | 'INVALID_FOLDER_NAME'
  | 'INVALID_BRANCH_NAME'
  | 'INVALID_PACKAGE_MANAGER'
  | 'INVALID_PRESET'
  | 'INVALID_WORKSPACE_TYPE'
  | 'INVALID_APP_NAME'
  | 'PRESET_FAILED'
  | 'SANDBOX_FAILED'
  | 'TEMPLATE_CLONE_FAILED'
  | 'CI_WORKFLOW_FAILED'
  | 'WORKSPACE_CREATION_FAILED'
  | 'ANGULAR_PREFIX_INVALID'
  | 'NETWORK_ERROR'
  | 'PACKAGE_INSTALL_ERROR'
  | 'UNKNOWN';

/**
 * Custom error class for CNW errors.
 * Used for structured error reporting and telemetry.
 */
export class CnwError extends Error {
  constructor(
    public readonly code: CnwErrorCode,
    message: string,
    public readonly logFile?: string,
    public readonly exitCode?: number
  ) {
    super(message);
    this.name = 'CnwError';
  }
}

/**
 * @deprecated Use CnwError instead
 */
export class CreateNxWorkspaceError extends Error {
  constructor(
    public logMessage: string,
    public code: number | null | undefined,
    public logFile: string
  ) {
    super(logMessage);
    this.name = 'CreateNxWorkspaceError';
  }
}

export function mapErrorToBodyLines(error: Error): string[] {
  const errorLines = error.message?.split('\n').filter((line) => !!line.trim());
  if (errorLines.length < 3) {
    const lines = [`Error: ${error.message}`];
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      lines.push(`Stack: ${error.stack}`);
    }
    return lines;
  }

  const lines =
    error instanceof CreateNxWorkspaceError
      ? [`Exit code: ${error.code}`, `Log file: ${error.logFile}`]
      : error instanceof CnwError && error.logFile
        ? [`Log file: ${error.logFile}`]
        : [];

  if (process.env.NX_VERBOSE_LOGGING === 'true') {
    lines.push(`Error: ${error.message}`);
    lines.push(`Stack: ${error.stack}`);
  }
  return lines;
}
