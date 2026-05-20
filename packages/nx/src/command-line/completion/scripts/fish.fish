###-begin-nx-completions-###
#
# nx command completion script for fish
#
# Installation:
#   mkdir -p ~/.config/fish/completions
#   nx completion fish > ~/.config/fish/completions/nx.fish
#
complete -e -c nx

function __nx_completions
  set -l tokens (commandline -cop)
  set -l current (commandline -ct)
  # Prefer the workspace's local nx over PATH; falls back to PATH outside a workspace.
  # Checks both standard (node_modules/.bin/nx) and .nx-style (.nx/installation/...) layouts.
  # Bare `nx` rather than an absolute path: that would tie completion to whatever
  # install was active when `nx completion fish` ran, breaking across worktrees or
  # after a move.
  set -l nx_cmd nx
  set -l dir $PWD
  while test "$dir" != "/"
    if test -x "$dir/node_modules/.bin/nx"
      set nx_cmd "$dir/node_modules/.bin/nx"
      break
    end
    if test -x "$dir/.nx/installation/node_modules/.bin/nx"
      set nx_cmd "$dir/.nx/installation/node_modules/.bin/nx"
      break
    end
    set dir (dirname "$dir")
  end
  # Stderr is hidden so a stray warning never lands in the completion buffer.
  # Honors NX_VERBOSE_LOGGING (Nx's standard debug switch) to surface it.
  if test -n "$NX_VERBOSE_LOGGING"
    NX_COMPLETE=fish $nx_cmd $tokens "$current"
  else
    NX_COMPLETE=fish $nx_cmd $tokens "$current" 2>/dev/null
  end
end
complete -c nx -f -a '(__nx_completions)'
###-end-nx-completions-###
