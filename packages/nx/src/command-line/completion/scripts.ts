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
  process.stderr.write(
    [
      `nx: \`nx\` is not on your PATH.`,
      `    The generated wrappers resolve a workspace-local nx when you`,
      `    tab-complete inside a project, but outside any workspace they`,
      `    fall back to a bare \`nx\`. Install nx globally so completion`,
      `    works everywhere (e.g. \`pnpm add -g nx\` or \`npm i -g nx\`).`,
      `    Continuing — pass --force to skip this notice.`,
      ``,
    ].join('\n')
  );
}

function writeScriptToRcFile(shell: Shell): void {
  const script = generateScript(shell);
  const path = installPathFor(shell);
  if (!path) {
    process.stderr.write(
      `nx: automatic install isn't supported for ${shell} yet — run with --stdout and redirect manually.\n`
    );
    return;
  }
  mkdirSync(dirname(path), { recursive: true });

  // Fish keeps each completion in its own file; bash/zsh/powershell append
  // to a shared rc file so we strip any existing nx block first.
  if (shell === 'fish') {
    writeFileSync(path, script);
  } else {
    const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
    const stripped = existing.replace(
      /###-begin-nx-completions-###[\s\S]*?###-end-nx-completions-###\n?/g,
      ''
    );
    const sep = stripped && !stripped.endsWith('\n') ? '\n' : '';
    writeFileSync(path, stripped + sep + script);
  }
  process.stderr.write(
    `nx: ${shell} completion installed at ${path}.\n` +
      `    Open a new shell (or re-source the rc file) to activate.\n`
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
// shellcheck. Read once at module load, emitted verbatim.
const WRAPPER_FILES: Record<Shell, string> = {
  bash: 'bash.sh',
  zsh: 'zsh.zsh',
  fish: 'fish.fish',
  powershell: 'powershell.ps1',
};
const wrappers: Record<Shell, string> = {
  bash: readFileSync(join(__dirname, 'scripts', WRAPPER_FILES.bash), 'utf-8'),
  zsh: readFileSync(join(__dirname, 'scripts', WRAPPER_FILES.zsh), 'utf-8'),
  fish: readFileSync(join(__dirname, 'scripts', WRAPPER_FILES.fish), 'utf-8'),
  powershell: readFileSync(
    join(__dirname, 'scripts', WRAPPER_FILES.powershell),
    'utf-8'
  ),
};

export function generateScript(shell: Shell): string {
  return wrappers[shell];
}
