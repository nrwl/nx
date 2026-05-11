import { registerCompletion } from '../completion/metadata';
import {
  getProjectNameCompletions,
  getTargetNameCompletions,
} from '../completion/completion-providers';

// `nx affected` — no positionals; project/target completion comes from flags.
// Aliases are written out because the fast path runs before yargs loads, so
// we can't resolve them dynamically. If yargs's alias declarations change,
// update the duplicates here.
registerCompletion('affected', {
  flags: {
    projects: getProjectNameCompletions,
    p: getProjectNameCompletions,
    exclude: getProjectNameCompletions,
    // wrapper lambdas because getTargetNameCompletions takes an optional
    // projectName whose type collides with the dispatcher's args parameter.
    targets: (current) => getTargetNameCompletions(current),
    target: (current) => getTargetNameCompletions(current),
    t: (current) => getTargetNameCompletions(current),
  },
});
