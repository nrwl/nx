// Backslash-escape embedded quotes per MS C runtime convention, then wrap in
// quotes. Callers caret-escape cmd.exe metacharacters on top.
export function quoteCmdArg(arg: string): string {
  return `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1')}"`;
}

const CMD_META_CHARS = /([()\][!^"`<>&|;, ])/g;

export function caretEscape(quoted: string): string {
  return quoted.replace(CMD_META_CHARS, '^$1');
}

/**
 * Stops cmd.exe expanding `%VAR%` inside an argument. A caret cannot escape
 * `%`, since expansion runs before caret processing, so each `%` becomes
 * `%%cd:~,%`: `%cd:~,%` is a zero-length substring of a built-in and expands to
 * nothing, leaving the leading `%`. Runs after the caret passes so the `,` it
 * introduces stays uncareted, which the substring syntax requires.
 */
export function neutralizePercent(escaped: string): string {
  return escaped.replace(/%/g, '%%cd:~,%');
}
