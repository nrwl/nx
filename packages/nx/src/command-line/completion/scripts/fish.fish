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
  # Walk up for a workspace-local nx; fall back to PATH outside a workspace.
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
  # Hide stderr so stray warnings don't land in the buffer; NX_VERBOSE_LOGGING surfaces it.
  set -l output
  if test -n "$NX_VERBOSE_LOGGING"
    set output (NX_COMPLETE=fish $nx_cmd $tokens "$current")
  else
    set output (NX_COMPLETE=fish $nx_cmd $tokens "$current" 2>/dev/null)
  end
  if test (count $output) -gt 0
    printf '%s\n' $output
    return
  end
  # No nx completion — fall back to filename completion. `-f` on the
  # `complete` declaration blocks fish's BUILT-IN file offering, but
  # we can still emit path candidates from inside the function. Append
  # '/' to directories so fish keeps the cursor in them (no trailing
  # space). Emitting bare paths (no description tab) preserves the
  # slash through fish's completion machinery — __fish_complete_path's
  # tab-separated output gets the slash stripped by fish when picking a
  # unique candidate.
  for match in $current*
    if test -d $match
      echo $match/
    else
      echo $match
    end
  end
end
complete -c nx -f -a '(__nx_completions)'
###-end-nx-completions-###
