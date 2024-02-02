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
