import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { CommandModule } from 'yargs';

function getCompletionBinPath(): string | null {
  const exe =
    process.platform === 'win32' ? 'nx-completion.exe' : 'nx-completion';

  // Check local dist (development)
  const localBin = join(__dirname, '..', '..', 'native', exe);
  if (existsSync(localBin)) {
    return localBin;
  }

  // Check platform-specific npm package (production)
  try {
    const platformPkg = require.resolve(
      `@nx/nx-${process.platform}-${process.arch}/${exe}`
    );
    if (existsSync(platformPkg)) {
      return platformPkg;
    }
  } catch {
    // Platform package not installed
  }

  return null;
}

function generateShellScript(shell: string): void {
  const bin = getCompletionBinPath();
  if (!bin) {
    console.error(
      `Shell completion binary not found. Run 'nx build nx-completion' first.`
    );
    process.exit(1);
  }

  const script = {
    fish: `###-begin-nx-completions-###
# Erase any previous nx completions to avoid duplicates
complete -e -c nx

function __nx_completions
  set -l tokens (commandline -cop)
  set -l current (commandline -ct)
  "${bin}" $tokens "$current" 2>/dev/null
end
complete -c nx -f -a '(__nx_completions)'
###-end-nx-completions-###
`,
    bash: `###-begin-nx-completions-###
_nx_completions()
{
    local cur_word args type_list
    cur_word="\${COMP_WORDS[COMP_CWORD]}"
    args=("\${COMP_WORDS[@]}")
    type_list=$("${bin}" "\${args[@]}" 2>/dev/null)
    COMPREPLY=( $(compgen -W "\${type_list}" -- \${cur_word}) )
    return 0
}
complete -o default -F _nx_completions nx
###-end-nx-completions-###
`,
    zsh: `###-begin-nx-completions-###
if type compdef &>/dev/null; then
  _nx_completions () {
    local reply
    local si=$IFS
    IFS=$'\\n' reply=($("${bin}" "\${words[@]}" 2>/dev/null))
    IFS=$si
    _describe 'values' reply
  }
  compdef _nx_completions nx
fi
###-end-nx-completions-###
`,
  }[shell];

  if (!script) {
    console.error(`Unknown shell: ${shell}`);
    process.exit(1);
  }

  process.stdout.write(script);
}

export const yargsCompletionCommand: CommandModule = {
  command: 'completion',
  describe:
    'Output shell completion script for bash, zsh, or fish. Run `nx completion --help` for installation instructions.',
  builder: (yargs) =>
    yargs
      .command(bashCompletionCommand)
      .command(zshCompletionCommand)
      .command(fishCompletionCommand)
      .demandCommand(1, 'Please specify a shell: bash, zsh, or fish.')
      .example('$0 completion bash >> ~/.bashrc', 'Enable bash completion')
      .example('$0 completion zsh >> ~/.zshrc', 'Enable zsh completion')
      .example(
        '$0 completion fish > ~/.config/fish/completions/nx.fish',
        'Enable fish completion'
      ),
  handler: async () => {},
};

const bashCompletionCommand: CommandModule = {
  command: 'bash',
  describe: 'Output bash completion script.',
  handler: () => generateShellScript('bash'),
};

const zshCompletionCommand: CommandModule = {
  command: 'zsh',
  describe: 'Output zsh completion script.',
  handler: () => generateShellScript('zsh'),
};

const fishCompletionCommand: CommandModule = {
  command: 'fish',
  describe: 'Output fish completion script.',
  handler: () => generateShellScript('fish'),
};
