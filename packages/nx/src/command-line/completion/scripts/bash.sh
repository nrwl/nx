###-begin-nx-completions-###
#
# nx command completion script
#
# Installation: nx completion bash >> ~/.bashrc
#    or: nx completion bash >> ~/.bash_profile
#
_nx_completions()
{
    local cur_word args type_list nx_cmd dir

    cur_word="${COMP_WORDS[COMP_CWORD]}"
    args=("${COMP_WORDS[@]}")

    # Walk up for a workspace-local nx; fall back to PATH outside a workspace.
    nx_cmd="nx"
    dir="$PWD"
    while [ "$dir" != "/" ]; do
      if [ -x "$dir/node_modules/.bin/nx" ]; then
        nx_cmd="$dir/node_modules/.bin/nx"
        break
      fi
      if [ -x "$dir/.nx/installation/node_modules/.bin/nx" ]; then
        nx_cmd="$dir/.nx/installation/node_modules/.bin/nx"
        break
      fi
      dir="$(dirname "$dir")"
    done

    # Hide stderr so stray warnings don't land in the buffer; NX_VERBOSE_LOGGING surfaces it.
    if [ -n "$NX_VERBOSE_LOGGING" ]; then
      type_list=$(NX_COMPLETE=bash "$nx_cmd" "${args[@]}")
    else
      type_list=$(NX_COMPLETE=bash "$nx_cmd" "${args[@]}" 2>/dev/null)
    fi

    COMPREPLY=( $(compgen -W "${type_list}" -- ${cur_word}) )

    # Trailing ':' (project:target stage 1) — nospace so the user can TAB again.
    if [ ${#COMPREPLY[@]} -eq 1 ] && [[ "${COMPREPLY[0]}" == *: ]]; then
      compopt -o nospace 2>/dev/null
    fi

    if [ ${#COMPREPLY[@]} -eq 0 ]; then
      COMPREPLY=()
    fi

    return 0
}
complete -o default -F _nx_completions nx
###-end-nx-completions-###
