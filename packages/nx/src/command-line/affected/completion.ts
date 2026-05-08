import { registerCompletion } from '../completion/metadata';
import {
  getProjectNameCompletions,
  getTargetNameCompletions,
} from '../completion/completion-providers';

// `nx affected` — no positionals; project/target completion comes from flags.
registerCompletion('affected', {
  flags: {
    projects: (current) => getProjectNameCompletions(current),
    p: (current) => getProjectNameCompletions(current),
    targets: (current) => getTargetNameCompletions(current),
    target: (current) => getTargetNameCompletions(current),
    t: (current) => getTargetNameCompletions(current),
    exclude: (current) => getProjectNameCompletions(current),
  },
});
