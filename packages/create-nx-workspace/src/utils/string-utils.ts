export function stringifyCollection(items: string[]): string {
  return items.map((item) => `"${item}"`).join(', ');
}

export function getFileName(name: string) {
  return name
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[ _]/g, '-');
}

export function mapErrorToBodyLines(error: {
  logMessage: string;
  code: number;
  logFile: string;
}): string[] {
  if (error.logMessage?.split('\n').filter((line) => !!line).length < 3) {
    // print entire log message only if it's only a single message
    return [`Error: ${error.logMessage}`];
  }
  const lines = [`Exit code: ${error.code}`, `Log file: ${error.logFile}`];
  if (process.env.NX_VERBOSE_LOGGING) {
    lines.push(`Error: ${error.logMessage}`);
  }
  return lines;
}
