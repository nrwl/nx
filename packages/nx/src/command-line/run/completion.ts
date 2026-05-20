import { registerCompletion } from '../completion/metadata';
import {
  completeProjectTarget,
  getProjectNamesWithTarget,
} from '../completion/completion-providers';
import { readCachedProjectGraph } from '../../project-graph/project-graph';

// `nx run <project>:<target>` — single positional.
registerCompletion('run', {
  positionals: [{ complete: completeProjectTarget }],
});

// Infix notation: `nx <target> <project>` — e.g. `nx build my-app`. Each
// target name is its own completion path. Suggestions filter to projects
// that actually have the target so e.g. `nx build <TAB>` skips projects
// without a build target.
//
// We enumerate every target name in the cached project graph so custom
// targets (`compile`, `deploy`, `storybook`, ...) get infix completion
// too, then union with a conventional set so cold workspaces (no graph
// yet) still get the everyday names.
const CONVENTIONAL_TARGETS = [
  'build',
  'serve',
  'test',
  'lint',
  'e2e',
  'dev',
  'start',
  'preview',
  'typecheck',
];

const targetNames = new Set<string>(CONVENTIONAL_TARGETS);
try {
  const graph = readCachedProjectGraph();
  for (const node of Object.values(graph?.nodes ?? {})) {
    for (const t of Object.keys(node?.data?.targets ?? {})) {
      targetNames.add(t);
    }
  }
} catch {
  // No cached graph (cold workspace) — fall back to the conventional set.
}

for (const targetName of targetNames) {
  registerCompletion(targetName, {
    positionals: [
      {
        complete: (current) => getProjectNamesWithTarget(current, targetName),
      },
    ],
  });
}
