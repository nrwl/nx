import { existsSync, readFileSync } from 'fs';
import { delimiter, join } from 'path';

type Shell = 'bash' | 'zsh' | 'fish' | 'powershell';

interface PrintCompletionScriptArgs {
  force?: boolean;
}

export async function printCompletionScript(
  shell: Shell,
  args: PrintCompletionScriptArgs
): Promise<void> {
  // PATH check is for the outside-workspace fallback only; inside a
  // workspace the wrapper walks up to the local nx. Advisory.
  if (!args.force && !isNxOnPath()) {
    warnNxNotOnPath(shell);
  }
  process.stdout.write(generateScript(shell));
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
  const installCommand = {
    bash: 'nx completion bash >> ~/.bashrc',
    zsh: 'nx completion zsh >> ~/.zshrc',
    fish: 'mkdir -p ~/.config/fish/completions && nx completion fish > ~/.config/fish/completions/nx.fish',
    powershell: 'nx completion powershell | Out-File -Append $PROFILE',
  }[shell];
  process.stderr.write(
    [
      `nx: \`nx\` is not on your PATH.`,
      `    The generated ${shell} script resolves a workspace-local nx when`,
      `    you tab-complete inside a project, but outside any workspace it`,
      `    falls back to a bare \`nx\`. Install nx globally for completion to`,
      `    work everywhere (e.g. \`pnpm add -g nx\` or \`npm i -g nx\`):`,
      `        ${installCommand}`,
      `    The script has still been emitted. Pass --force to skip this notice.`,
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

function generateScript(shell: Shell): string {
  return wrappers[shell];
}
