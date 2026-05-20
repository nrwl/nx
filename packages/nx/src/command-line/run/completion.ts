import { registerCompletion } from '../completion/metadata';
import {
  completeProjectTarget,
  getProjectNamesWithTarget,
} from '../completion/completion-providers';
import { readCachedProjectGraph } from '../../project-graph/project-graph';

registerCompletion('run', {
  positionals: [{ complete: completeProjectTarget }],
});

// `nx <target> <project>` infix completion. Every target in the graph gets
// its own path; union with a conventional fallback for cold workspaces.
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
  // No cached graph — conventional set only.
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
