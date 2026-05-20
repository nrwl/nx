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
  // The generated POSIX scripts resolve a workspace-local nx at TAB time
  // (walk-up) and only fall back to a bare `nx` from PATH outside a
  // workspace. So the script always works inside a workspace; the bare-PATH
  // fallback is the only part that needs `nx` reachable by name. Warn (to
  // stderr, non-fatal) when it isn't, but still emit the script — `--force`
  // suppresses the warning entirely.
  if (!args.force && !isNxOnPath()) {
    warnNxNotOnPath(shell);
  }
  process.stdout.write(generateScript(shell));
}

/**
 * True if a bare `nx` executable resolves on the current PATH. Correctly
 * covers a global install and an `npx nx ...` invocation (npx prepends the
 * package's `.bin` to PATH). A raw `./node_modules/.bin/nx` invocation does
 * not put `.bin` on PATH and will report false — that's fine, the warning
 * is advisory and the script still works inside a workspace via walk-up.
 */
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

// The four shell wrappers live as plain files in ./scripts/ so they get
// real syntax highlighting and can be linted by shellcheck / fish_indent /
// etc. They're read once at module load (tiny files, no per-invocation
// cost) and emitted verbatim — nothing is templated.
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
