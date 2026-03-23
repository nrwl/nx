/**
 * Shell completion scripts for Nx CLI.
 * Each script calls a lightweight completion binary that reads the cached
 * project graph directly — no heavy nx startup.
 *
 * The command is resolved at generation time and baked into the script.
 * If the Rust binary exists, it's used directly. Otherwise falls back
 * to running the Node.js script via `node`.
 */

import { existsSync } from 'fs';
import { join } from 'path';

function getCompletionCommand(): string {
  // Prefer the Rust binary (fast) if it exists, fall back to Node.js
  const rustBin = join(__dirname, '..', '..', 'native', 'nx-completion');
  if (existsSync(rustBin)) {
    return rustBin;
  }
  return `node "${join(__dirname, '..', '..', '..', 'bin', 'completion.js')}"`;
}

export function getBashCompletionScript(): string {
  const cmd = getCompletionCommand();
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

    type_list=$(${cmd} "\${args[@]}" 2>/dev/null)

    COMPREPLY=( $(compgen -W "\${type_list}" -- \${cur_word}) )

    if [ \${#COMPREPLY[@]} -eq 0 ]; then
      COMPREPLY=()
    fi

    return 0
}
complete -o default -F _nx_yargs_completions nx
###-end-nx-completions-###
`;
}

export function getZshCompletionScript(): string {
  const cmd = getCompletionCommand();
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
    IFS=$'\\n' reply=($(${cmd} "\${words[@]}" 2>/dev/null))
    IFS=$si
    _describe 'values' reply
  }
  compdef _nx_yargs_completions nx
fi
###-end-nx-completions-###
`;
}

export function getFishCompletionScript(): string {
  const cmd = getCompletionCommand();
  return `###-begin-nx-completions-###
#
# nx command completion script for fish
#
# Installation: nx completion fish > ~/.config/fish/completions/nx.fish
#
# Erase any previous nx completions to avoid duplicates
complete -e -c nx

function __nx_yargs_completions
  set -l tokens (commandline -cop)
  set -l current (commandline -ct)
  ${cmd} $tokens "$current" 2>/dev/null
end
complete -c nx -f -a '(__nx_yargs_completions)'
###-end-nx-completions-###
`;
}
