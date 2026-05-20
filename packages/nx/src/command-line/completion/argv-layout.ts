// Wrappers must invoke nx with argv: [node, nx-bin, ...tokens, currentPartial].

export interface ParsedCompletionArgs {
  tokens: string[];
  current: string;
  previousToken: string;
}

export function parseCompletionArgs(): ParsedCompletionArgs | null {
  const tail = process.argv.slice(2);
  const tokens = tail[0] === 'nx' ? tail.slice(1) : tail;
  if (tokens.length === 0) return null;

  const current = tokens[tokens.length - 1] ?? '';
  const previousToken = tokens.length >= 2 ? tokens[tokens.length - 2] : '';

  return { tokens, current, previousToken };
}
