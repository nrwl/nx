import { parse } from 'unbash';

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
 * Check if a string is already a single, quoted shell word.
 *
 * A value is only safe to forward verbatim if the shell will read it as exactly
 * one word of one command. Comparing the first and last character cannot
 * establish that: `"a" "b"` is two words and `"x" && rm -rf / ; echo "y"` is
 * three commands, yet both start and end with a quote.
 */
export function isAlreadyQuoted(str: string): boolean {
  if (str.length < 2) {
    return false;
  }

  const quote = str[0];
  if ((quote !== "'" && quote !== '"') || str[str.length - 1] !== quote) {
    return false;
  }

  const script = parse(str);
  if (script.errors?.length || script.commands.length !== 1) {
    return false;
  }

  const statement = script.commands[0];
  if (statement.type !== 'Statement' || statement.redirects?.length) {
    return false;
  }

  const command = statement.command;
  if (
    command?.type !== 'Command' ||
    command.prefix?.length ||
    command.suffix?.length ||
    command.redirects?.length
  ) {
    return false;
  }

  // The single word has to span the whole value, and it has to actually be
  // quoted. A bare word such as `plain` is not "already quoted".
  const word = command.name;
  return (
    word?.pos === 0 &&
    word.end === str.length &&
    !!word.parts?.some(
      (part) => part.type === 'SingleQuoted' || part.type === 'DoubleQuoted'
    )
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
 * this path does not implement.
 */
export function quoteShellArg(arg: string): string {
  const isWindows = process.platform === 'win32';
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
