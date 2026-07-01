import { isCI } from './is-ci';

/**
 * Sets up a 'q' keypress listener for graceful shutdown in non-TUI interactive mode.
 * Only activates when stdin is a TTY and not running in CI.
 *
 * This should only be called from contexts where the TUI is NOT active.
 * The dynamic life cycles are only used when TUI is disabled, and commands
 * like `nx watch` and `nx graph` never use the TUI.
 *
 * Returns a cleanup function to remove the listener.
 */
export function handleQToQuit(onQuit: () => void): () => void {
  if (!process.stdin.isTTY || isCI()) {
    return () => {};
  }

  const onData = (data: string) => {
    if (data === 'q') {
      onQuit();
    } else if (data === '\x03') {
      // Ctrl+C is swallowed in raw mode, so we re-emit SIGINT
      process.kill(process.pid, 'SIGINT');
    }
  };

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', onData);
  process.stdin.unref();

  return () => {
    process.stdin.off('data', onData);
    process.stdin.pause();
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  };
}
