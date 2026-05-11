import { registerCompletion } from '../completion/metadata';
import {
  getProjectNameCompletions,
  getTargetNameCompletions,
} from '../completion/completion-providers';

// `nx run-many` — no positionals; project/target completion comes from
// flags. If yargs's alias declarations change, update the duplicates here.
registerCompletion('run-many', {
  flags: {
    projects: getProjectNameCompletions,
    p: getProjectNameCompletions,
    // wrapper lambdas because getTargetNameCompletions takes an optional
    // projectName whose type collides with the dispatcher's args parameter.
    targets: (current) => getTargetNameCompletions(current),
    target: (current) => getTargetNameCompletions(current),
    t: (current) => getTargetNameCompletions(current),
  },
});
