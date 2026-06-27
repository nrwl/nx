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
 * Wrap a CLI arg in double quotes when it contains shell metacharacters,
 * so it survives being passed to `spawn(..., { shell: true })`. For
 * `--key=value` form, only the value side is quoted.
 */
export function wrapArgIntoQuotesIfNeeded(arg: string): string {
  if (arg.includes('=')) {
    const eqIndex = arg.indexOf('=');
    const key = arg.substring(0, eqIndex);
    const value = arg.substring(eqIndex + 1);
    if (
      key.startsWith('--') &&
      needsShellQuoting(value) &&
      !isAlreadyQuoted(value)
    ) {
      const escaped = value.replace(/"/g, '\\"');
      return `${key}="${escaped}"`;
    }
    return arg;
  } else if (needsShellQuoting(arg) && !isAlreadyQuoted(arg)) {
    const escaped = arg.replace(/"/g, '\\"');
    return `"${escaped}"`;
  } else {
    return arg;
  }
}
