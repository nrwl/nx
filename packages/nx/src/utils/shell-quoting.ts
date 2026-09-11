/**
 * Shell metacharacters that have special meaning and require quoting.
 *
 * Characters included:
 * - | - pipe
 * - & - background/AND
 * - ; - command separator
 * - < > - redirections
 * - ( ) - subshell
 * - $ - variable expansion
 * - ` - command substitution
 * - \ - escape
 * - " ' - quotes
 * - * ? [ ] - globbing
 * - { } - brace expansion
 * - ~ - home directory
 * - # - comment
 * - ! - history expansion
 * - \s - whitespace (spaces, tabs, newlines)
 */
const SHELL_META_CHARS = /[|&;<>()$`\\!"'*?[\]{}~#\s]/;

/**
 * A line break ends a cmd.exe command line whatever the quoting, so no quoted
 * run can carry one. POSIX single quotes hold a newline fine, which is why the
 * refusal in `quoteShellArg` is Windows-only.
 */
export const LINE_BREAK = /[\r\n]/;

/**
 * Check if a string contains shell metacharacters that require quoting.
 * These characters have special meaning in shell and would be interpreted
 * incorrectly if not quoted (e.g., | for pipe, & for background, etc.)
 */
export function needsShellQuoting(str: string): boolean {
  return SHELL_META_CHARS.test(str);
}

/**
 * Check if a string is already wrapped in matching quotes (single or double).
 */
export function isAlreadyQuoted(str: string): boolean {
  return (
    str.length >= 2 &&
    ((str[0] === "'" && str[str.length - 1] === "'") ||
      (str[0] === '"' && str[str.length - 1] === '"'))
  );
}

/**
 * Quote a string so it survives being interpolated into a shell command line
 * as a single argument.
 *
 * On Windows the safety boundary is one unbroken double-quoted run: it keeps
 * `^`, `&`, `|`, `<` and `>` literal through cmd.exe's parse and a `.cmd`
 * shim's re-parse of `%*`, but not `%`, which cmd.exe expands inside double
 * quotes too.
 *
 * @throws on Windows when the argument contains a double quote, which ends that
 * run, since cmd.exe recognizes no backslash escape. Carrying one means
 * caret-escaping every metacharacter instead, doubled for a `.cmd` shim, which
 * this path does not implement. Also throws on a line break, which ends the
 * command line itself and so survives no quoting at all.
 */
export function quoteShellArg(arg: string): string {
  const isWindows = process.platform === 'win32';
  if (isWindows && LINE_BREAK.test(arg)) {
    throw new Error(
      `Cannot safely pass ${arg} to cmd.exe as a single argument: a line break inside it would end the command line and leave the rest of the argument to be read as commands. Remove the line break and run the command again.`
    );
  }
  if (isWindows && arg.includes('"')) {
    throw new Error(
      `Cannot safely pass ${arg} to cmd.exe as a single argument: a double quote inside it would end the quoting and leave the rest of the argument to be read as commands. Remove the double quote and run the command again.`
    );
  }
  if (arg === '') {
    // an unquoted empty string would vanish when joined into a command line
    return isWindows ? '""' : "''";
  }
  // `^` is cmd.exe syntax rather than shell syntax, so it earns quoting only
  // where cmd.exe parses the command line.
  if (!needsShellQuoting(arg) && !(isWindows && arg.includes('^'))) {
    return arg;
  }
  return isWindows
    ? // MSVCRT reads the backslashes that precede the closing quote as escapes,
      // so they have to be doubled to survive as themselves.
      `"${arg.replace(/(\\+)$/, '$1$1')}"`
    : `'${arg.replace(/'/g, `'\\''`)}'`;
}
