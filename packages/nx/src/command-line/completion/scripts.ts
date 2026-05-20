import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { delimiter, dirname, join } from 'path';

export type Shell = 'bash' | 'zsh' | 'fish' | 'powershell';
export const SHELLS: readonly Shell[] = ['bash', 'zsh', 'fish', 'powershell'];

/** Print the raw wrapper script to stdout — for scripting / custom rc paths. */
export function printCompletionScript(shell: Shell): void {
  process.stdout.write(generateScript(shell));
}

/**
 * Write the wrapper to the shell's default rc location, replacing any prior
 * nx-completion block (idempotent via the begin/end markers). Logs the
 * resolved path and a one-line "open a new shell" hint.
 */
export function installCompletionScript(shell: Shell): void {
  writeScriptToRcFile(shell);
}

/**
 * Stderr advisory when `nx` is not on PATH — the wrappers walk up for a
 * workspace-local nx, but the outside-workspace fallback needs `nx`
 * reachable by name. Callers fire this ONCE per invocation even when
 * installing for multiple shells.
 */
export function maybeWarnNxNotOnPath(): void {
  if (isNxOnPath()) return;
  console.warn(
    [
      `nx: \`nx\` is not on your PATH.`,
      `    The generated wrappers resolve a workspace-local nx when you`,
      `    tab-complete inside a project, but outside any workspace they`,
      `    fall back to a bare \`nx\`. Install nx globally so completion`,
      `    works everywhere (e.g. \`pnpm add -g nx\` or \`npm i -g nx\`).`,
      `    Continuing — pass --force to skip this notice.`,
    ].join('\n')
  );
}

function writeScriptToRcFile(shell: Shell): void {
  const script = generateScript(shell);
  const path = installPathFor(shell);
  if (!path) {
    console.warn(
      `nx: automatic install isn't supported for ${shell} yet — run with --stdout and redirect manually.`
    );
    return;
  }
  mkdirSync(dirname(path), { recursive: true });

  // Fish keeps each completion in its own file (a full overwrite is correct).
  // bash/zsh/powershell append to a shared rc file: skip if an nx-completion
  // block is already present so re-runs are no-ops, and never modify
  // existing content — the user may have customized around the block.
  if (shell === 'fish') {
    writeFileSync(path, script);
  } else {
    const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
    if (existing.includes('###-begin-nx-completions-###')) {
      console.warn(
        `nx: ${shell} completion already present in ${path} — skipping.\n` +
          `    Remove the existing block manually if you need to reinstall.`
      );
      return;
    }
    const sep = existing && !existing.endsWith('\n') ? '\n' : '';
    writeFileSync(path, existing + sep + script);
  }
  console.warn(
    `nx: ${shell} completion installed at ${path}.\n` +
      `    Open a new shell (or re-source the rc file) to activate.`
  );
}

function installPathFor(shell: Shell): string | null {
  const home = homedir();
  switch (shell) {
    case 'bash':
      return join(home, '.bashrc');
    case 'zsh':
      return join(home, '.zshrc');
    case 'fish':
      return join(home, '.config', 'fish', 'completions', 'nx.fish');
    case 'powershell':
      return resolvePowerShellProfile();
  }
}

/**
 * Shell out to PowerShell to expand $PROFILE. The variable's resolution
 * depends on the PS version, $PSVersionTable, and Windows Documents-folder
 * redirection (OneDrive etc.), so asking PS itself is the only reliable
 * way. Returns null if no PowerShell executable is found — caller falls
 * back to a manual-install hint.
 */
function resolvePowerShellProfile(): string | null {
  const candidates =
    process.platform === 'win32' ? ['pwsh.exe', 'powershell.exe'] : ['pwsh'];
  for (const exe of candidates) {
    const result = spawnSync(exe, ['-NoProfile', '-Command', '$PROFILE'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    if (result.status === 0 && result.stdout) {
      const path = result.stdout.trim();
      if (path) return path;
    }
  }
  return null;
}

function isNxOnPath(): boolean {
  const pathEnv = process.env.PATH;
  if (!pathEnv) return false;
  const names =
    process.platform === 'win32' ? ['nx.cmd', 'nx.exe', 'nx'] : ['nx'];
  for (const dir of pathEnv.split(delimiter)) {
    if (!dir) continue;
    for (const name of names) {
      if (existsSync(join(dir, name))) return true;
    }
  }
  return false;
}

// Wrappers live as plain files in ./scripts/ for syntax highlighting and
// shellcheck. Read at call time — each invocation needs each shell's
// wrapper at most once.
const WRAPPER_FILES: Record<Shell, string> = {
  bash: 'bash.sh',
  zsh: 'zsh.zsh',
  fish: 'fish.fish',
  powershell: 'powershell.ps1',
};

export function generateScript(shell: Shell): string {
  return readFileSync(
    join(__dirname, 'scripts', WRAPPER_FILES[shell]),
    'utf-8'
  );
}
