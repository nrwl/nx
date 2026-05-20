###-begin-nx-completions-###
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
    # Bare `nx` rather than an absolute path: that would tie completion to whatever
    # install was active when `nx completion zsh` ran, breaking across worktrees or
    # after a move.
    nx_cmd="nx"
    dir="$PWD"
    while [[ "$dir" != "/" ]]; do
      if [[ -x "$dir/node_modules/.bin/nx" ]]; then
        nx_cmd="$dir/node_modules/.bin/nx"
        break
      fi
      if [[ -x "$dir/.nx/installation/node_modules/.bin/nx" ]]; then
        nx_cmd="$dir/.nx/installation/node_modules/.bin/nx"
        break
      fi
      dir="${dir:h}"
    done

    # Stderr is hidden so a stray warning never lands in the completion
    # buffer. Honors NX_VERBOSE_LOGGING (Nx's standard debug switch) to surface it.
    if [[ -n "$NX_VERBOSE_LOGGING" ]]; then
      IFS=$'\n' reply=($(NX_COMPLETE=zsh "$nx_cmd" "${words[@]}"))
    else
      IFS=$'\n' reply=($(NX_COMPLETE=zsh "$nx_cmd" "${words[@]}" 2>/dev/null))
    fi
    IFS=$si

    # Each line is either a bare value or `value<TAB>description`. Split into
    # parallel arrays and feed `compadd -d`: the value is inserted literally
    # (values like `my-app:build` contain colons, so `_describe` — which
    # splits on ':' — must not be used), the description is shown in the menu.
    local -a values displays
    local r value nospace=0
    for r in $reply; do
      value="${r%%$'\t'*}"
      values+=("$value")
      if [[ "$r" == *$'\t'* ]]; then
        displays+=("$value -- ${r#*$'\t'}")
      else
        displays+=("$value")
      fi
      # A trailing ':' (project name before a target) means TAB-again;
      # suppress the inserted space so the user can keep typing.
      [[ "$value" == *: ]] && nospace=1
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
