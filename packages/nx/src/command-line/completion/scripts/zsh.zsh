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

    # Walk up for a workspace-local nx; fall back to PATH outside a workspace.
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

    # Hide stderr so stray warnings don't land in the buffer; NX_VERBOSE_LOGGING surfaces it.
    if [[ -n "$NX_VERBOSE_LOGGING" ]]; then
      IFS=$'\n' reply=($(NX_COMPLETE=zsh "$nx_cmd" "${words[@]}"))
    else
      IFS=$'\n' reply=($(NX_COMPLETE=zsh "$nx_cmd" "${words[@]}" 2>/dev/null))
    fi
    IFS=$si

    # Split `value\tdescription` into parallel arrays for compadd -d. Don't
    # use _describe: it splits on ':', mangling values like `my-app:build`.
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
      [[ "$value" == *: ]] && nospace=1  # trailing ':' → nospace
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
