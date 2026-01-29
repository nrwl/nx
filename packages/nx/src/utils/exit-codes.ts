/**
 * Translates NodeJS signals to numeric exit code
 * @param signal
 */
export function signalToCode(signal: NodeJS.Signals | null): number {
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

// Exit codes from signals that indicate intentional termination (SIGHUP, SIGINT, SIGQUIT, SIGTERM).
// Excludes SIGKILL (137) and SIGABRT (134) as those indicate abnormal termination.
export const EXPECTED_TERMINATION_SIGNALS = new Set([129, 130, 131, 143]);

/**
 * Translates a pty exit message (e.g. "Terminated by Interrupt") to a numeric exit code.
 * Handles both Linux exact-match and macOS strsignal formats (e.g. "Terminated by Hangup: 1").
 */
export function messageToCode(message: string): number {
  if (message.startsWith('Terminated by ')) {
    const signalDescription = message.replace('Terminated by ', '').trim();
    if (signalDescription.startsWith('Hangup')) return 129;
    if (signalDescription.startsWith('Interrupt')) return 130;
    if (signalDescription.startsWith('Quit')) return 131;
    if (signalDescription.startsWith('Abort')) return 134;
    if (signalDescription.startsWith('Killed')) return 137;
    if (signalDescription.startsWith('Terminated')) return 143;
    return 128;
  } else if (message.startsWith('Exited with code ')) {
    return parseInt(message.replace('Exited with code ', '').trim());
  } else if (message === 'Success') {
    return 0;
  } else {
    return 1;
  }
}
