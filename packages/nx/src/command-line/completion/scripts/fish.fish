###-begin-nx-completions-###
#
# nx command completion script for fish
#
# Installation:
#   mkdir -p ~/.config/fish/completions
#   nx completion fish > ~/.config/fish/completions/nx.fish
#
complete -e -c nx

# In a world-writable directory (/tmp) only trust entries owned by you or root.
function __nx_trusted_entry
  set -l shared (find -H $argv[1] -prune -perm -0002 2>/dev/null)
  test -z "$shared"; and return 0
  set -l owned (find $argv[1]/$argv[2] -prune \( -user (id -u) -o -user 0 \) 2>/dev/null)
  test -n "$owned"
end

function __nx_completions
  set -l tokens (commandline -cop)
  set -l current (commandline -ct)
  # Walk up for a workspace-local nx; fall back to PATH outside a workspace.
  set -l nx_cmd nx
  set -l dir $PWD
  while test "$dir" != "/"
    if test -x "$dir/node_modules/.bin/nx"; and __nx_trusted_entry "$dir" node_modules
      set nx_cmd "$dir/node_modules/.bin/nx"
      break
    end
    if test -x "$dir/.nx/installation/node_modules/.bin/nx"; and __nx_trusted_entry "$dir" .nx
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
  # fish exposes __fish_complete_path for callers that want the same
  # behaviour (trailing '/' on dirs, ~ expansion, hidden-file handling,
  # fish_complete_path config) from inside a function.
  __fish_complete_path $current
end
complete -c nx -f -a '(__nx_completions)'
###-end-nx-completions-###
