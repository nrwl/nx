import { execSync } from 'child_process';

export function restoreTermiosAfterAgent(): void {
  if (process.platform === 'win32') return;
  if (!process.stdin.isTTY) return;
  try {
    // Not setRawMode(false): it short-circuits when libuv's per-handle mode
    // is already NORMAL, even after the agent changed termios out-of-band.
    // `stty sane` goes through the kernel instead.
    execSync('stty sane < /dev/tty', {
      stdio: ['ignore', 'ignore', 'ignore'],
      windowsHide: true,
    });
    // Carriage-return + clear to end of screen, to wipe any agent TUI
    // cells below our row that subsequent log lines won't overwrite
    // (e.g. a status footer past where our text wraps).
    process.stdout.write('\r\x1B[J');
  } catch {
    // Best-effort: if stty isn't on PATH or /dev/tty isn't accessible, the
    // worst case is the pre-existing staircase + cell-bleed output.
  }
}
