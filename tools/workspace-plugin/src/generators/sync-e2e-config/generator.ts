import {
  formatFiles,
  getProjects,
  globAsync,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { relative } from 'node:path';
import { join } from 'path';

export async function syncE2eConfigsGenerator(tree: Tree) {
  for (const [projName, projectConfig] of getProjects(tree)) {
    const { root, targets } = projectConfig;
    if (!root.startsWith('e2e/')) {
      continue;
    }

    const testFiles = await globAsync(tree, [join(root, `**/*.test.ts`)]);

    for (const testFile of testFiles) {
      const relativePath = relative(root, testFile);
      let target = (targets[`e2e-ci--${relativePath}`] ??= {});
      target.dependsOn = [
        'nx:build-native',
        '@nx/nx-source:populate-local-registry-storage',
      ];
      target.inputs = ['e2eInputs', '^production'];
    }
    updateProjectConfiguration(tree, projName, projectConfig);
  }

  await formatFiles(tree);
}

export default syncE2eConfigsGenerator;
