import { existsSync } from 'fs';
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
    fish: 'nx completion fish > ~/.config/fish/completions/nx.fish',
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

function generateScript(shell: Shell): string {
  switch (shell) {
    case 'bash':
      return generateBashScript();
    case 'zsh':
      return generateZshScript();
    case 'fish':
      return generateFishScript();
    case 'powershell':
      return generatePowershellScript();
  }
}

// Fallback command name. At TAB time the POSIX wrappers first walk up from
// the cwd to find a workspace-local nx (so completions reflect the installed
// version); this bare `nx` is used only when no local install is found —
// e.g. outside any workspace. We deliberately don't bake in an absolute path:
// that would tie completion to whatever install happened to be active when
// `nx completion <shell>` ran, breaking across worktrees or after a move.
const NX_COMMAND = 'nx';

function generateBashScript(): string {
  return `###-begin-nx-completions-###
#
# nx command completion script
#
# Installation: nx completion bash >> ~/.bashrc
#    or: nx completion bash >> ~/.bash_profile
#
_nx_completions()
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

    # Stderr is hidden so a stray warning never lands in the completion
    # buffer. Set NX_COMPLETE_DEBUG to surface it when completion misbehaves.
    local err_to=/dev/null
    [ -n "\$NX_COMPLETE_DEBUG" ] && err_to=/dev/stderr
    type_list=$(NX_COMPLETE=bash "\$nx_cmd" "\${args[@]}" 2>"\$err_to")

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
complete -o default -F _nx_completions nx
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
  _nx_completions () {
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

    # Stderr is hidden so a stray warning never lands in the completion
    # buffer. Set NX_COMPLETE_DEBUG to surface it when completion misbehaves.
    local err_to=/dev/null
    [[ -n "\$NX_COMPLETE_DEBUG" ]] && err_to=/dev/stderr
    IFS=$'\\n' reply=($(NX_COMPLETE=zsh "\$nx_cmd" "\${words[@]}" 2>"\$err_to"))
    IFS=$si

    # Each line is either a bare value or \`value<TAB>description\`. Split into
    # parallel arrays and feed \`compadd -d\`: the value is inserted literally
    # (values like \`my-app:build\` contain colons, so \`_describe\` — which
    # splits on ':' — must not be used), the description is shown in the menu.
    local -a values displays
    local r value nospace=0
    for r in \$reply; do
      value="\${r%%\$'\\t'*}"
      values+=("\$value")
      if [[ "\$r" == *\$'\\t'* ]]; then
        displays+=("\$value -- \${r#*\$'\\t'}")
      else
        displays+=("\$value")
      fi
      # A trailing ':' (project name before a target) means TAB-again;
      # suppress the inserted space so the user can keep typing.
      [[ "\$value" == *: ]] && nospace=1
    done

    if (( nospace )); then
      compadd -S '' -d displays -a values
    else
      compadd -d displays -a values
    fi
  }
  compdef _nx_completions nx
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

function __nx_completions
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
  # Stderr is hidden so a stray warning never lands in the completion buffer.
  # Set NX_COMPLETE_DEBUG to surface it when completion misbehaves.
  set -l err_to /dev/null
  test -n "\$NX_COMPLETE_DEBUG"; and set err_to /dev/stderr
  NX_COMPLETE=fish \$nx_cmd \$tokens "\$current" 2>\$err_to
end
complete -c nx -f -a '(__nx_completions)'
###-end-nx-completions-###
`;
}

function generatePowershellScript(): string {
  // PowerShell uses Register-ArgumentCompleter — the shell hands us the
  // partial command AST and we return CompletionResult objects. The
  // ArgumentList we pass to nx mirrors the POSIX layout: the tokenized
  // command (including the partial), so value-completions.ts can read it
  // the same way it reads COMP_WORDS / words.
  return `###-begin-nx-completions-###
#
# nx command completion script for PowerShell
#
# Installation: nx completion powershell | Out-File -Append $PROFILE
#
Register-ArgumentCompleter -Native -CommandName nx -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)

    $tokens = @($commandAst.CommandElements | ForEach-Object { $_.Extent.Text })
    # If the cursor is past the last token, append an empty current word so
    # the binary sees the same '[...userTokens, currentPartial]' layout as
    # the POSIX wrappers emit.
    if ($cursorPosition -gt $commandAst.Extent.EndOffset) {
        $tokens += ''
    }

    # Prefer the workspace's local nx over PATH, like the POSIX wrappers.
    # Walks up from the cwd checking the standard and .nx-style layouts;
    # uses nx.cmd, the executable PowerShell can invoke on Windows.
    $nxCmd = '${NX_COMMAND}'
    $dir = $PWD.Path
    while ($dir) {
        $standard = Join-Path $dir 'node_modules\\.bin\\nx.cmd'
        $nxStyle = Join-Path $dir '.nx\\installation\\node_modules\\.bin\\nx.cmd'
        if (Test-Path -LiteralPath $standard) { $nxCmd = $standard; break }
        if (Test-Path -LiteralPath $nxStyle) { $nxCmd = $nxStyle; break }
        $parent = Split-Path -Parent $dir
        if ($parent -eq $dir) { break }
        $dir = $parent
    }

    $env:NX_COMPLETE = 'powershell'
    try {
        # Stderr is hidden so a stray warning never lands in the completion
        # buffer. Set NX_COMPLETE_DEBUG to surface it when completion
        # misbehaves.
        if ($env:NX_COMPLETE_DEBUG) {
            $lines = & $nxCmd @tokens
        } else {
            $lines = & $nxCmd @tokens 2>$null
        }
        # Note: PowerShell appends a space after each completion. Two-stage
        # 'project:' / 'plugin:' completion still works — the user deletes
        # the space or types ':' — but there is no per-result nospace API.
        $lines | ForEach-Object {
            [System.Management.Automation.CompletionResult]::new($_)
        }
    } finally {
        Remove-Item Env:NX_COMPLETE -ErrorAction SilentlyContinue
    }
}
###-end-nx-completions-###
`;
}
