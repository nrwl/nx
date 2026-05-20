import { registerCompletion } from '../completion/metadata';
import {
  completeProjectTarget,
  getProjectNameCompletions,
} from '../completion/completion-providers';

// `nx show project <project>` — single project positional.
registerCompletion('show project', {
  positionals: [{ complete: getProjectNameCompletions }],
});

// `nx show target` accepts two equivalent forms:
//   nx show target <project>:<target> [inputs|outputs]
//   nx show target [inputs|outputs] <project>:<target>
// so the first positional can be either a project:target or the
// `inputs`/`outputs` keyword.
const TARGET_SUBCOMMANDS = ['inputs', 'outputs'];
registerCompletion('show target', {
  positionals: [
    {
      complete: (current, args) => [
        ...completeProjectTarget(current, args),
        ...TARGET_SUBCOMMANDS.filter((k) => k.startsWith(current)),
      ],
    },
    { choices: TARGET_SUBCOMMANDS },
  ],
});

// `nx show target inputs|outputs <project>:<target>` — once the keyword
// has been typed, the next positional is just the project:target.
registerCompletion('show target inputs', {
  positionals: [{ complete: completeProjectTarget }],
});
registerCompletion('show target outputs', {
  positionals: [{ complete: completeProjectTarget }],
});
