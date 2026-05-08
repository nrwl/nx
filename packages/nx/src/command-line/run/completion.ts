import { registerCompletion } from '../completion/metadata';
import {
  completeProjectTarget,
  getProjectNamesWithTarget,
} from '../completion/completion-providers';

// `nx run <project>:<target>` — single positional.
registerCompletion('run', {
  positionals: [{ complete: (current) => completeProjectTarget(current) }],
});

// Infix notation: `nx <target> <project>` — e.g. `nx build my-app`. Each
// target name is its own completion path. Suggestions filter to projects
// that actually have the target so e.g. `nx build <TAB>` skips projects
// without a build target.
const INFIX_TARGETS = [
  'build',
  'serve',
  'test',
  'lint',
  'e2e',
  'dev',
  'start',
  'preview',
  'typecheck',
] as const;

for (const targetName of INFIX_TARGETS) {
  registerCompletion(targetName, {
    positionals: [
      {
        complete: (current) => getProjectNamesWithTarget(current, targetName),
      },
    ],
  });
}
