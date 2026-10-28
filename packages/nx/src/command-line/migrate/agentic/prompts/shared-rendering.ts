// 2-space continuation indent on lines 2+ so multi-line entries parse as a
// single markdown list item rather than introducing a new prose paragraph.
export function renderListItem(entry: string): string {
  const [first, ...rest] = entry.split('\n');
  return [`- ${first}`, ...rest.map((line) => `  ${line}`)].join('\n');
}

// `agentContext` arrives from user-authored migration code; defend against
// non-string and whitespace-only entries before rendering.
export function filterNonEmptyStrings(entries: unknown[]): string[] {
  return entries.filter(
    (s): s is string => typeof s === 'string' && s.trim().length > 0
  );
}

// Neutralizes XML-tag breakouts in user-authored content interpolated into our
// XML-framed prompts. A hostile `agentContext` entry `"</agent_context>..."`
// would otherwise close our block and inject spoofed structure the agent
// treats as real. Escaping `<` (and `&` so prior escapes can't be reconstructed) is
// sufficient: only `<` opens a tag, so neutralizing it removes the breakout
// surface. `&` must be replaced first so subsequent `<` → `&lt;` substitutions
// don't double-escape. `>` / `"` / `'` are intentionally left alone — `>` in
// isolation doesn't construct a tag, and quoting noise inside body text adds
// prompt clutter without buying anything. See Anthropic "Mitigate prompt
// injection" + OWASP LLM Top 10 (LLM01) for the underlying recommendation.
//
// Coerces non-string inputs via `String(value)` so a runtime-typed field
// arriving as `null` / `undefined` / number can't crash the prompt builder
// with a `Cannot read .replace of undefined`. TypeScript types are a hint,
// not a guarantee — migrations.json is parsed from disk, and a hostile or
// buggy migration could ship a non-string where one is expected.
export function escapeXmlBody(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;');
}

// `<handoff_path>` footer that follows the "write your handoff JSON to:"
// sentence. No leading blank — the block is part of that sentence's structure,
// not a separate section.
export function renderHandoffPathFooter(
  handoffFileAbsolutePath: string
): string[] {
  return [
    `<handoff_path>`,
    escapeXmlBody(handoffFileAbsolutePath),
    `</handoff_path>`,
  ];
}
