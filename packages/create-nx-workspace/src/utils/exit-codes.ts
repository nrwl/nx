/**
 * Ends the process the way an interrupted process ends: by SIGINT, not by
 * exiting with its conventional code.
 *
 * A shell reports 130 either way, but a parent using waitpid sees
 * `signal: 'SIGINT'` rather than `code: 130`, which is what tools wrapping
 * this CLI check to tell "the user pressed Ctrl+C" from "the command failed".
 *
 * Kept in sync with `packages/nx/src/utils/exit-codes.ts`; this package
 * deliberately does not depend on `nx`.
 */
export function exitAsInterrupted(): never {
  // Windows has no signal disposition to inherit - `process.kill` there
  // terminates with an arbitrary code - so keep the 128+SIGINT convention.
  if (process.platform !== 'win32') {
    // Any listener would swallow this; the default action is what terminates.
    process.removeAllListeners('SIGINT');
    process.kill(process.pid, 'SIGINT');
  }
  process.exit(130);
}
