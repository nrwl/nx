// Dependency-free on purpose. Every module that renders text an AI agent will
// read needs this, run/run-state.ts included, and that one cannot reach
// run/util.ts without a cycle through run/state-lock.ts.

/**
 * Collapses every character a reader could take for a line break, so a value
 * cannot break out of the line it is rendered on. The driving agent scans this
 * same stdout for `<nx_migrate_*>` blocks, which are framed by a bare newline,
 * so a value carrying its own break could open a forged one at a line start.
 *
 * U+0085, U+2028 and U+2029 are in the set because "line start" is the
 * reader's notion, not this process's: a JavaScript `^` under `/m` treats the
 * latter two as terminators, and Nx does not know what parses its output.
 * Quoting is not a substitute, since `JSON.stringify` leaves all three
 * literal.
 *
 * For values Nx does not author: a migration's summary or next steps, a
 * handoff an agent wrote, a persisted run-state string, a directory name off
 * disk. Every other character is kept, only the line structure is not.
 */
export function singleLine(value: string): string {
  return value.replace(/[\x00-\x1f\x7f\u0085\u2028\u2029]+/g, ' ');
}
