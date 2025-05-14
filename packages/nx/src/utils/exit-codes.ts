/**
 * Translates NodeJS signals to numeric exit code
 * @param signal
 */
export function signalToCode(signal: NodeJS.Signals): number {
  switch (signal) {
    case 'SIGHUP':
      return 128 + 1;
    case 'SIGINT':
      return 128 + 2;
    case 'SIGTERM':
      return 128 + 15;
    default:
      return 128;
  }
}

/**
 * Translates numeric exit codes to NodeJS signals
 */
export function codeToSignal(code: number): NodeJS.Signals {
  switch (code) {
    case 128 + 1:
      return 'SIGHUP';
    case 128 + 2:
      return 'SIGINT';
    case 128 + 15:
      return 'SIGTERM';
    default:
      return 'SIGTERM';
  }
}
