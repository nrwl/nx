import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { delimiter, dirname, join } from 'path';

export type Shell = 'bash' | 'zsh' | 'fish' | 'powershell';
export const SHELLS: readonly Shell[] = ['bash', 'zsh', 'fish', 'powershell'];

interface CompletionScriptArgs {
  force?: boolean;
  stdout?: boolean;
}

export async function printCompletionScript(
  shell: Shell,
  args: CompletionScriptArgs
): Promise<void> {
  // PATH check is for the outside-workspace fallback only; inside a
  // workspace the wrapper walks up to the local nx. Advisory.
  if (!args.force && !isNxOnPath()) {
    warnNxNotOnPath(shell);
  }
  if (args.stdout) {
    process.stdout.write(generateScript(shell));
    return;
  }
  installScript(shell);
}

/**
 * Write the wrapper to the shell's default rc location, replacing any prior
 * nx-completion block (idempotent via the begin/end markers). Logs the
 * resolved path and a one-line "open a new shell" hint.
 */
function installScript(shell: Shell): void {
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
      // $PROFILE resolution needs pwsh; punt for now and tell the user.
      return null;
  }
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

function warnNxNotOnPath(shell: Shell): void {
  process.stderr.write(
    [
      `nx: \`nx\` is not on your PATH.`,
      `    The generated ${shell} script resolves a workspace-local nx when`,
      `    you tab-complete inside a project, but outside any workspace it`,
      `    falls back to a bare \`nx\`. Install nx globally so completion`,
      `    works everywhere (e.g. \`pnpm add -g nx\` or \`npm i -g nx\`).`,
      `    Continuing — pass --force to skip this notice.`,
      ``,
    ].join('\n')
  );
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
