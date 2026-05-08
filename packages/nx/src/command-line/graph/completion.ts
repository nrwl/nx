import { registerCompletion } from '../completion/metadata';
import {
  getProjectNameCompletions,
  getTargetNameCompletions,
} from '../completion/completion-providers';

// `nx graph` — no positionals; project completion comes from --focus / --exclude.
registerCompletion('graph', {
  flags: {
    targets: (current) => getTargetNameCompletions(current),
    target: (current) => getTargetNameCompletions(current),
    t: (current) => getTargetNameCompletions(current),
    focus: (current) => getProjectNameCompletions(current),
    exclude: (current) => getProjectNameCompletions(current),
  },
});
