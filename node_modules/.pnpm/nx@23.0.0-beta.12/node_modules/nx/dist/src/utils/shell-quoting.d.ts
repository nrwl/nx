/**
 * Check if a string contains shell metacharacters that require quoting.
 * These characters have special meaning in shell and would be interpreted
 * incorrectly if not quoted (e.g., | for pipe, & for background, etc.)
 */
export declare function needsShellQuoting(str: string): boolean;
/**
 * Check if a string is already wrapped in matching quotes (single or double).
 */
export declare function isAlreadyQuoted(str: string): boolean;
