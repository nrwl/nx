type Shell = 'bash' | 'zsh' | 'fish';

interface PrintCompletionScriptArgs {
  force?: boolean;
}

export async function printCompletionScript(
  shell: Shell,
  args: PrintCompletionScriptArgs
): Promise<void> {
  if (!args.force && !isRunningAsGlobalNx()) {
    warnNxNotOnPath(shell);
    process.exit(1);
  }
  process.stdout.write(generateScript(shell));
}

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

function warnNxNotOnPath(shell: Shell): void {
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

function generateScript(shell: Shell): string {
  switch (shell) {
    case 'bash':
      return generateBashScript();
    case 'zsh':
      return generateZshScript();
    case 'fish':
      return generateFishScript();
  }
}

// Emit a PATH-resolved `nx` so the script works from any cwd or worktree.
// Baking in an absolute path ties completion to the install location that
// happened to be active when `nx completion <shell>` was run — bad when
// users have multiple worktrees or move/delete the original workspace.
// At TAB time the wrappers prefer the workspace's local nx so completions
// reflect the installed version (and we sidestep the global → local handoff,
// which can leak version-mismatch banners into stdout).
const NX_COMMAND = 'nx';

function generateBashScript(): string {
  return `###-begin-nx-completions-###
#
# nx command completion script
#
# Installation: nx completion bash >> ~/.bashrc
#    or: nx completion bash >> ~/.bash_profile
#
_nx_yargs_completions()
{
    local cur_word args type_list nx_cmd dir

    cur_word="\${COMP_WORDS[COMP_CWORD]}"
    args=("\${COMP_WORDS[@]}")

    # Prefer the workspace's local nx over PATH; falls back to PATH outside a workspace.
    # Checks both standard (node_modules/.bin/nx) and .nx-style (.nx/installation/...) layouts.
    nx_cmd="${NX_COMMAND}"
    dir="\$PWD"
    while [ "\$dir" != "/" ]; do
      if [ -x "\$dir/node_modules/.bin/nx" ]; then
        nx_cmd="\$dir/node_modules/.bin/nx"
        break
      fi
      if [ -x "\$dir/.nx/installation/node_modules/.bin/nx" ]; then
        nx_cmd="\$dir/.nx/installation/node_modules/.bin/nx"
        break
      fi
      dir="\$(dirname "\$dir")"
    done

    type_list=$("\$nx_cmd" --get-yargs-completions "\${args[@]}" 2>/dev/null)

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
  return `###-begin-nx-completions-###
#
# nx command completion script
#
# Installation: nx completion zsh >> ~/.zshrc
#    or: nx completion zsh > /usr/local/share/zsh/site-functions/_nx
#
if type compdef &>/dev/null; then
  _nx_yargs_completions () {
    local reply nx_cmd dir
    local si=$IFS

    # Prefer the workspace's local nx over PATH; falls back to PATH outside a workspace.
    # Checks both standard (node_modules/.bin/nx) and .nx-style (.nx/installation/...) layouts.
    nx_cmd="${NX_COMMAND}"
    dir="\$PWD"
    while [[ "\$dir" != "/" ]]; do
      if [[ -x "\$dir/node_modules/.bin/nx" ]]; then
        nx_cmd="\$dir/node_modules/.bin/nx"
        break
      fi
      if [[ -x "\$dir/.nx/installation/node_modules/.bin/nx" ]]; then
        nx_cmd="\$dir/.nx/installation/node_modules/.bin/nx"
        break
      fi
      dir="\${dir:h}"
    done

    IFS=$'\\n' reply=($("\$nx_cmd" --get-yargs-completions "\${words[@]}" 2>/dev/null))
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
  # Prefer the workspace's local nx over PATH; falls back to PATH outside a workspace.
  # Checks both standard (node_modules/.bin/nx) and .nx-style (.nx/installation/...) layouts.
  set -l nx_cmd ${NX_COMMAND}
  set -l dir $PWD
  while test "\$dir" != "/"
    if test -x "\$dir/node_modules/.bin/nx"
      set nx_cmd "\$dir/node_modules/.bin/nx"
      break
    end
    if test -x "\$dir/.nx/installation/node_modules/.bin/nx"
      set nx_cmd "\$dir/.nx/installation/node_modules/.bin/nx"
      break
    end
    set dir (dirname "\$dir")
  end
  \$nx_cmd --get-yargs-completions \$tokens "\$current" 2>/dev/null
end
complete -c nx -f -a '(__nx_yargs_completions)'
###-end-nx-completions-###
`;
}
