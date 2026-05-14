/**
 * Shared argv parsing for the completion entry points. The shell-script
 * wrappers invoke `nx` with `NX_COMPLETE=<shell>` set and pass the user's
 * partial command (including the trailing partial token) as the binary's
 * arguments. argv at TAB time is:
 *
 *   [node, nx-bin, ...shellTokens, currentPartial]
 *
 * `shellTokens[0]` is the command name as the shell sees it (typically
 * literally `'nx'`), so we strip that too. The remainder are the user-typed
 * tokens plus the empty/partial token for the position being completed.
 */

export interface ParsedCompletionArgs {
  /** All locked-in tokens plus the trailing partial. */
  tokens: string[];
  /** The trailing partial being completed (last element of tokens). */
  current: string;
  /** The token before the partial — used for `--flag <TAB>` detection. */
  previousToken: string;
}

export function parseCompletionArgs(): ParsedCompletionArgs | null {
  // Drop the node binary + nx script path.
  const tail = process.argv.slice(2);
  // The shell wrappers pass the command name as the first arg.
  const tokens = tail[0] === 'nx' ? tail.slice(1) : tail;
  if (tokens.length === 0) return null;

  const current = tokens[tokens.length - 1] ?? '';
  const previousToken = tokens.length >= 2 ? tokens[tokens.length - 2] : '';

  return { tokens, current, previousToken };
}
