import { registerCompletion } from '../completion/metadata';
import {
  completeProjectTarget,
  getProjectNameCompletions,
} from '../completion/completion-providers';

registerCompletion('show project', {
  positionals: [{ complete: getProjectNameCompletions }],
});

// `nx show target` accepts the keyword on either side of the target —
// `nx show target my-app:build inputs` or `nx show target inputs my-app:build`.
const TARGET_SUBCOMMANDS = ['inputs', 'outputs'];
registerCompletion('show target', {
  positionals: [
    {
      complete: (current) => [
        ...completeProjectTarget(current),
        ...TARGET_SUBCOMMANDS.filter((k) => k.startsWith(current)),
      ],
    },
    { choices: TARGET_SUBCOMMANDS },
  ],
});

registerCompletion('show target inputs', {
  positionals: [{ complete: completeProjectTarget }],
});
registerCompletion('show target outputs', {
  positionals: [{ complete: completeProjectTarget }],
});
