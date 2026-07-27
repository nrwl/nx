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
