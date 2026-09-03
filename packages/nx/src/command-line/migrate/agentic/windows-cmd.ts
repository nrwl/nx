// Backslash-escape embedded quotes per MS C runtime convention, then wrap in
// quotes. Callers caret-escape cmd.exe metacharacters on top.
export function quoteCmdArg(arg: string): string {
  return `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1')}"`;
}

// No `%`: a caret does not stop `%VAR%` expansion, `neutralizePercent` does.
const CMD_META_CHARS = /([()\][!^"`<>&|;, ])/g;

export function caretEscape(quoted: string): string {
  return quoted.replace(CMD_META_CHARS, '^$1');
}

/**
 * Stops cmd.exe expanding `%VAR%` inside an argument. Variable expansion runs
 * before caret processing, so each `%` becomes `%%cd:~,%`: `%cd:~,%` is a
 * zero-length substring of the built-in `cd` variable, which expands to
 * nothing and leaves the leading `%` behind. Same substitution the Rust
 * standard library applies to batch-file arguments.
 *
 * Runs after the caret passes so the `,` it introduces stays uncareted; cmd
 * would not recognize the substring syntax otherwise.
 */
export function neutralizePercent(escaped: string): string {
  return escaped.replace(/%/g, '%%cd:~,%');
}
