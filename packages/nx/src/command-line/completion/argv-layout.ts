/**
 * Shared argv parsing for the completion entry points.
 *
 * This is the contract between every shell wrapper (see scripts.ts) and the
 * TS side: each wrapper — however it assembles the tokens internally — MUST
 * invoke `nx` with `NX_COMPLETE=<shell>` set and produce this exact argv:
 *
 *   [node, nx-bin, ...shellTokens, currentPartial]
 *
 * `shellTokens[0]` is the command name as the shell sees it (typically
 * literally `'nx'`), which we strip. `currentPartial` is the token at the
 * cursor (often empty). The wrappers build it differently — bash/zsh pass
 * `COMP_WORDS`/`words` (which already include the partial), fish appends
 * `(commandline -ct)`, PowerShell appends `''` when the cursor is past the
 * last AST element — but the resulting argv is identical.
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
