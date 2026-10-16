/**
 * Choose the stdin mode for forked task children.
 *
 * When the TUI is enabled on Windows and we cannot give the child its own
 * pseudo-terminal, inheriting the parent's stdin would let the child race
 * the TUI's crossterm EventStream for keystrokes on the same Windows
 * console input handle — observed as the TUI becoming unresponsive once
 * any child opens its own stdin reader (Angular dev-server's r/q/u
 * prompts, dotnet watch's Ctrl+R, MCP STDIO servers, etc.). See
 * docs/prd/issue-33720-PRD.md for the full analysis.
 *
 * 'ignore' isolates the TUI's input at the cost of the child losing its
 * direct stdin. Acceptable because users who want the child's stdin can
 * disable the TUI per-command with --tui=false.
 */
export function childStdinMode(opts: {
  tuiEnabled: boolean;
}): 'inherit' | 'ignore' {
  if (opts.tuiEnabled && process.platform === 'win32') {
    return 'ignore';
  }
  return 'inherit';
}
