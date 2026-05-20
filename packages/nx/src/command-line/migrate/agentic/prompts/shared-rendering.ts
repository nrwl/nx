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
