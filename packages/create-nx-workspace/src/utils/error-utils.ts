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
    if (process.env.NX_VERBOSE_LOGGING) {
      lines.push(`Stack: ${error.stack}`);
    }
    return lines;
  }

  const lines =
    error instanceof CreateNxWorkspaceError
      ? [`Exit code: ${error.code}`, `Log file: ${error.logFile}`]
      : [];

  if (process.env.NX_VERBOSE_LOGGING) {
    lines.push(`Error: ${error.message}`);
    lines.push(`Stack: ${error.stack}`);
  }
  return lines;
}
