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

    # Prefer the workspace's local nx over PATH; falls back to PATH outside a workspace.
    # Checks both standard (node_modules/.bin/nx) and .nx-style (.nx/installation/...) layouts.
    # Bare `nx` rather than an absolute path: that would tie completion to whatever
    # install was active when `nx completion bash` ran, breaking across worktrees or
    # after a move.
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

    # Stderr is hidden so a stray warning never lands in the completion
    # buffer. Honors NX_VERBOSE_LOGGING (Nx's standard debug switch) to surface it.
    if [ -n "$NX_VERBOSE_LOGGING" ]; then
      type_list=$(NX_COMPLETE=bash "$nx_cmd" "${args[@]}")
    else
      type_list=$(NX_COMPLETE=bash "$nx_cmd" "${args[@]}" 2>/dev/null)
    fi

    COMPREPLY=( $(compgen -W "${type_list}" -- ${cur_word}) )

    # If the (only) completion ends with ':' (e.g. "devkit:" for show target /
    # run), suppress the trailing space so the user can TAB again to pick a
    # target instead of having to backspace and type ':' manually.
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
