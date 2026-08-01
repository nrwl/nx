// Wrappers must invoke nx with argv: [node, nx-bin, ...tokens, currentPartial].

export interface ParsedCompletionArgs {
  tokens: string[];
  current: string;
  previousToken: string;
}

export function parseCompletionArgs(
  argv: readonly string[] = process.argv
): ParsedCompletionArgs | null {
  const tail = argv.slice(2);
  // Wrappers usually prepend the literal 'nx' (from COMP_WORDS /
  // commandline -cop / etc.). They sometimes don't — most notably the
  // `.nx/installation` wrapper invokes the real bin directly without the
  // 'nx' token, and manual invocations like `NX_COMPLETE=fish nx show
  // target in` for dev testing skip it too. Strip when present, otherwise
  // take the args as-is.
  const tokens = tail[0] === 'nx' ? tail.slice(1) : tail;
  if (tokens.length === 0) return null;

  const current = tokens[tokens.length - 1] ?? '';
  const previousToken = tokens.length >= 2 ? tokens[tokens.length - 2] : '';

  return { tokens, current, previousToken };
}
