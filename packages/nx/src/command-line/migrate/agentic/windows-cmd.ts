// Backslash-escape embedded quotes per MS C runtime convention, then wrap in
// quotes. Callers caret-escape cmd.exe metacharacters on top.
export function quoteCmdArg(arg: string): string {
  return `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1')}"`;
}
