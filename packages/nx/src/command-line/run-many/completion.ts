import { registerCompletion } from '../completion/metadata';
import {
  getProjectNameCompletions,
  getTargetNameCompletions,
} from '../completion/completion-providers';

// `nx run-many` — no positionals; project/target completion comes from
// flags. If yargs's alias declarations change, update the duplicates here.
registerCompletion('run-many', {
  flags: {
    projects: (current) => getProjectNameCompletions(current),
    p: (current) => getProjectNameCompletions(current),
    targets: (current) => getTargetNameCompletions(current),
    target: (current) => getTargetNameCompletions(current),
    t: (current) => getTargetNameCompletions(current),
  },
});
