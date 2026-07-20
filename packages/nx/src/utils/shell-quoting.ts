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
 * as a single argument. Strings without shell metacharacters pass through
 * unquoted.
 *
 * On POSIX shells quoting preserves the content exactly: the argument is
 * wrapped in single quotes (which suppress all interpolation), escaping
 * embedded single quotes. On Windows it is wrapped in double quotes
 * following the MSVCRT argv parsing rules (backslashes are only special
 * when they precede a double quote); cmd.exe-level metacharacters (`%`, `^`)
 * are not escaped.
 */
export function quoteShellArg(arg: string): string {
  if (arg === '') {
    // an unquoted empty string would vanish when joined into a command line
    return process.platform === 'win32' ? '""' : "''";
  }
  if (!needsShellQuoting(arg)) {
    return arg;
  }
  return process.platform === 'win32'
    ? `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1')}"`
    : `'${arg.replace(/'/g, `'\\''`)}'`;
}
