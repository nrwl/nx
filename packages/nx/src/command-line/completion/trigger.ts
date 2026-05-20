// Shell detection via NX_COMPLETE env var (set by the wrappers).

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
