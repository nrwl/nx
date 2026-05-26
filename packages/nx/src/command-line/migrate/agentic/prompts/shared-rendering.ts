import type { FileChange } from '../../../../generators/tree';

export function renderFileEntry(change: FileChange): string {
  return `[${change.type}] ${change.path}`;
}

// 2-space continuation indent on lines 2+ so multi-line entries parse as a
// single markdown list item rather than introducing a new prose paragraph.
export function renderListItem(entry: string): string {
  const [first, ...rest] = entry.split('\n');
  return [`- ${first}`, ...rest.map((line) => `  ${line}`)].join('\n');
}

// YAML block-scalar form (`key: |`) for multi-line values inside `<migration>`,
// so embedded newlines don't break the inner block's visual grouping.
export function renderKeyMultilineValue(key: string, value: string): string[] {
  const valueLines = value.split('\n');
  if (valueLines.length === 1) {
    return [`${key}: ${value}`];
  }
  return [`${key}: |`, ...valueLines.map((line) => `  ${line}`)];
}

// picocolors emits `\x1b[Nm` sequences; the regex catches simple SGR codes
// and any extended CSI sequence terminating in a letter.
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;
export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '');
}

// `agentContext` arrives from user-authored migration code; defend against
// non-string and whitespace-only entries before rendering.
export function filterNonEmptyStrings(entries: unknown[]): string[] {
  return entries.filter(
    (s): s is string => typeof s === 'string' && s.trim().length > 0
  );
}

// Neutralizes XML-tag breakouts in user-authored content interpolated into our
// XML-framed prompts. A hostile migration `description: "</migration>…"` would
// otherwise close our block and inject spoofed structure the agent treats as
// real. Escaping `<` (and `&` so prior escapes can't be reconstructed) is
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

// Shared phrasing used by both prompt builders to point the agent at the
// working tree and the git commands that scope to this migration's
// contribution. Centralized so the command set and the "working tree is
// scoped" guarantee stay in lock-step across builders — the guarantee is
// the orchestrator's responsibility (per-migration commits + a checkpoint
// commit before the run) so the prompt's claim and the runtime invariant
// can't drift independently.
export function renderGitInspectInstruction(): string {
  return (
    `The working tree contains only this migration's contribution; previous ` +
    `migrations were committed and any pre-existing state was checkpointed ` +
    `before the run. Run \`git status --porcelain=v1 -uall\` from the ` +
    `workspace root for the list of affected paths, then \`git diff -- <path>\` ` +
    `(tracked) or \`cat <path>\` (new files) for content.`
  );
}
