import { registerCompletion } from '../completion/metadata';
import {
  completeProjectTarget,
  getProjectNameCompletions,
} from '../completion/completion-providers';

// `nx show project <project>` — single project positional.
registerCompletion('show project', {
  positionals: [{ complete: (current) => getProjectNameCompletions(current) }],
});

// `nx show target <project>:<target> [inputs|outputs]` — first positional is
// the project:target token, second is an optional `inputs`/`outputs` choice.
registerCompletion('show target', {
  positionals: [
    { complete: (current) => completeProjectTarget(current) },
    { choices: ['inputs', 'outputs'] },
  ],
});
