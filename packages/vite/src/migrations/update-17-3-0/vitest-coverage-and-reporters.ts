import {
  ProjectConfiguration,
  Tree,
  formatFiles,
  getProjects,
  joinPathFragments,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { fixCoverageAndRerporters } from './lib/fix-coverage-and-reporters';

export default async function fixCoverageThreshold(tree: Tree) {
  const projects = getProjects(tree);
  forEachExecutorOptions(tree, '@nx/vite:test', (_options, projectName) => {
    const projectConfig: ProjectConfiguration = projects.get(
      projectName
    ) as ProjectConfiguration;
    const configPath = findViteConfig(tree, projectConfig.root);
    if (!configPath || !tree.exists(configPath)) {
      return;
    }
    const configContents = tree.read(configPath, 'utf-8') as string;
    const updatedConfigContents = fixCoverageAndRerporters(configContents);
    if (updatedConfigContents) {
      tree.write(configPath, updatedConfigContents);
    }
  });

  await formatFiles(tree);
}

function findViteConfig(tree: Tree, searchRoot: string) {
  const allowsExt = ['js', 'mjs', 'ts', 'cjs', 'mts', 'cts'];

  for (const ext of allowsExt) {
    if (tree.exists(joinPathFragments(searchRoot, `vite.config.${ext}`))) {
      return joinPathFragments(searchRoot, `vite.config.${ext}`);
    } else if (
      tree.exists(joinPathFragments(searchRoot, `vitest.config.${ext}`))
    ) {
      return joinPathFragments(searchRoot, `vitest.config.${ext}`);
    }
  }
}
