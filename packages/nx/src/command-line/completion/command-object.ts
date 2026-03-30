import { CommandModule } from 'yargs';

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
      .option('force', {
        type: 'boolean',
        default: false,
        describe:
          'Generate the completion script even if `nx` is not found on PATH.',
      })
      .example('$0 completion bash >> ~/.bashrc', 'Enable bash completion')
      .example('$0 completion zsh >> ~/.zshrc', 'Enable zsh completion')
      .example(
        '$0 completion fish > ~/.config/fish/completions/nx.fish',
        'Enable fish completion'
      ),
  handler: async () => {},
};

/**
 * The generated completion scripts invoke `nx --get-yargs-completions` at every
 * tab press, so they only work when `nx` resolves globally. `bin/nx.ts` already
 * records whether the current process was launched via a global nx (set during
 * `determineNxVersions`); reuse that instead of probing PATH with a subprocess.
 */
function isRunningAsGlobalNx(): boolean {
  return Boolean(
    (globalThis as { GLOBAL_NX_VERSION?: string }).GLOBAL_NX_VERSION
  );
}

function warnNxNotOnPath(shell: 'bash' | 'zsh' | 'fish'): void {
  const installCommand = {
    bash: 'nx completion bash >> ~/.bashrc',
    zsh: 'nx completion zsh >> ~/.zshrc',
    fish: 'nx completion fish > ~/.config/fish/completions/nx.fish',
  }[shell];
  process.stderr.write(
    [
      `nx: cannot install ${shell} completion — \`nx\` is not on your PATH.`,
      `    The generated script calls \`nx --get-yargs-completions\` at every`,
      `    tab press, which only works when \`nx\` resolves globally. Install`,
      `    nx globally (e.g. \`pnpm add -g nx\` or \`npm i -g nx\`), then re-run:`,
      `        ${installCommand}`,
      `    Or pass --force to emit the script anyway.`,
      ``,
    ].join('\n')
  );
}

function getNxCompletionCommand(): string {
  // Emit a PATH-resolved `nx` so the script works from any cwd or worktree.
  // Baking in an absolute path ties completion to the install location that
  // happened to be active when `nx completion <shell>` was run — bad when
  // users have multiple worktrees or move/delete the original workspace.
  return 'nx';
}

function generateBashScript(): string {
  const cmd = getNxCompletionCommand();
  return `###-begin-nx-completions-###
#
# nx command completion script
#
# Installation: nx completion bash >> ~/.bashrc
#    or: nx completion bash >> ~/.bash_profile
#
_nx_yargs_completions()
{
    local cur_word args type_list

    cur_word="\${COMP_WORDS[COMP_CWORD]}"
    args=("\${COMP_WORDS[@]}")

    type_list=$(${cmd} --get-yargs-completions "\${args[@]}" 2>/dev/null)

    COMPREPLY=( $(compgen -W "\${type_list}" -- \${cur_word}) )

    # If the (only) completion ends with ':' (e.g. "devkit:" for show target /
    # run), suppress the trailing space so the user can TAB again to pick a
    # target instead of having to backspace and type ':' manually.
    if [ \${#COMPREPLY[@]} -eq 1 ] && [[ "\${COMPREPLY[0]}" == *: ]]; then
      compopt -o nospace 2>/dev/null
    fi

    if [ \${#COMPREPLY[@]} -eq 0 ]; then
      COMPREPLY=()
    fi

    return 0
}
complete -o default -F _nx_yargs_completions nx
###-end-nx-completions-###
`;
}

function generateZshScript(): string {
  const cmd = getNxCompletionCommand();
  return `###-begin-nx-completions-###
#
# nx command completion script
#
# Installation: nx completion zsh >> ~/.zshrc
#    or: nx completion zsh > /usr/local/share/zsh/site-functions/_nx
#
if type compdef &>/dev/null; then
  _nx_yargs_completions () {
    local reply
    local si=$IFS
    IFS=$'\\n' reply=($(${cmd} --get-yargs-completions "\${words[@]}" 2>/dev/null))
    IFS=$si
    # When completions end with ':' (e.g. project names in \`nx show target\`
    # or \`nx run\`), omit the trailing space so the user can TAB again for
    # targets without having to delete a space and type ':' manually.
    local has_colon_suffix=0
    local r
    for r in \$reply; do
      if [[ "\$r" == *: ]]; then has_colon_suffix=1; break; fi
    done
    if (( has_colon_suffix )); then
      compadd -S '' -a reply
    else
      _describe 'values' reply
    fi
  }
  compdef _nx_yargs_completions nx
else
  echo "nx: shell completion requires zsh's completion system to be loaded." >&2
  echo "    Add the following line to your ~/.zshrc above this block:" >&2
  echo "        autoload -U compinit && compinit" >&2
fi
###-end-nx-completions-###
`;
}

function generateFishScript(): string {
  const cmd = getNxCompletionCommand();
  return `###-begin-nx-completions-###
#
# nx command completion script for fish
#
# Installation: nx completion fish > ~/.config/fish/completions/nx.fish
#
complete -e -c nx

function __nx_yargs_completions
  set -l tokens (commandline -cop)
  set -l current (commandline -ct)
  ${cmd} --get-yargs-completions \$tokens "\$current" 2>/dev/null
end
complete -c nx -f -a '(__nx_yargs_completions)'
###-end-nx-completions-###
`;
}

const bashCompletionCommand: CommandModule = {
  command: 'bash',
  describe: 'Output bash completion script.',
  handler: (args) => {
    if (!args.force && !isRunningAsGlobalNx()) {
      warnNxNotOnPath('bash');
      process.exit(1);
    }
    process.stdout.write(generateBashScript());
  },
};

const zshCompletionCommand: CommandModule = {
  command: 'zsh',
  describe: 'Output zsh completion script.',
  handler: (args) => {
    if (!args.force && !isRunningAsGlobalNx()) {
      warnNxNotOnPath('zsh');
      process.exit(1);
    }
    process.stdout.write(generateZshScript());
  },
};

const fishCompletionCommand: CommandModule = {
  command: 'fish',
  describe: 'Output fish completion script.',
  handler: (args) => {
    if (!args.force && !isRunningAsGlobalNx()) {
      warnNxNotOnPath('fish');
      process.exit(1);
    }
    process.stdout.write(generateFishScript());
  },
};
