import { registerCompletion } from '../completion/metadata';
import {
  getProjectNameCompletions,
  getTargetNameCompletions,
} from '../completion/completion-providers';

// `nx graph` — no positionals; project/target completion comes from flags.
registerCompletion('graph', {
  flags: {
    focus: getProjectNameCompletions,
    exclude: getProjectNameCompletions,
    // wrapper lambdas because getTargetNameCompletions takes an optional
    // projectName whose type collides with the dispatcher's args parameter.
    targets: (current) => getTargetNameCompletions(current),
    target: (current) => getTargetNameCompletions(current),
    t: (current) => getTargetNameCompletions(current),
  },
});
