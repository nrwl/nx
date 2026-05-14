/**
 * Shell-completion trigger detection. The shell-script wrappers set the
 * `NX_COMPLETE` env var to the shell type they run under (bash / zsh /
 * fish / powershell) before invoking nx. We detect that here rather than
 * scanning argv — keeps argv pristine and aligns with the clap convention
 * (`_<BIN>_COMPLETE=<shell>`).
 */

export type CompletionShell = 'bash' | 'zsh' | 'fish' | 'powershell';

const KNOWN_SHELLS: ReadonlySet<string> = new Set([
  'bash',
  'zsh',
  'fish',
  'powershell',
]);

export function isCompletionRequest(): boolean {
  return Boolean(process.env.NX_COMPLETE);
}

export function getCompletionShell(): CompletionShell | null {
  const raw = process.env.NX_COMPLETE;
  if (raw && KNOWN_SHELLS.has(raw)) {
    return raw as CompletionShell;
  }
  return null;
}
