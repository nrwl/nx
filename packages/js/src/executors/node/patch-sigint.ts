const readline = require('node:readline');

/**
 * Patches the current process so that Ctrl+C is properly handled.
 * Without this patch, SIGINT or Ctrl+C does not wait for graceful shutdown and exits immediately.
 */
export function patchSigint() {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.on('keypress', async (chunk, key) => {
    if (key && key.ctrl && key.name === 'c') {
      process.stdin.setRawMode(false); // To ensure nx terminal is not stuck in raw mode
      const listeners = process.listeners('SIGINT');
      for (const listener of listeners) {
        await listener('SIGINT');
      }
      process.exit(130);
    }
  });
  console.log('To exit the process, press Ctrl+C');
}
