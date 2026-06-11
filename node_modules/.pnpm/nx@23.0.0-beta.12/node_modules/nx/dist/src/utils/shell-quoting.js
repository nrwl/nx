"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.needsShellQuoting = needsShellQuoting;
exports.isAlreadyQuoted = isAlreadyQuoted;
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
function needsShellQuoting(str) {
    return SHELL_META_CHARS.test(str);
}
/**
 * Check if a string is already wrapped in matching quotes (single or double).
 */
function isAlreadyQuoted(str) {
    return (str.length >= 2 &&
        ((str[0] === "'" && str[str.length - 1] === "'") ||
            (str[0] === '"' && str[str.length - 1] === '"')));
}
