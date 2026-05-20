import { registerCompletion } from '../completion/metadata';
import {
  getProjectNameCompletions,
  getTargetNameCompletions,
} from '../completion/completion-providers';

// Aliases are written out; the fast path runs before yargs can resolve them.
registerCompletion('affected', {
  flags: {
    projects: getProjectNameCompletions,
    p: getProjectNameCompletions,
    exclude: getProjectNameCompletions,
    targets: (current) => getTargetNameCompletions(current),
    target: (current) => getTargetNameCompletions(current),
    t: (current) => getTargetNameCompletions(current),
  },
});
