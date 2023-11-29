import {
  Tree,
  formatFiles,
  getProjects,
  joinPathFragments,
  offsetFromRoot,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { ViteBuildExecutorOptions } from '../../executors/build/schema';
import { updateBuildOutDirAndRoot } from './lib/edit-build-config';
import { updateTestConfig } from './lib/edit-test-config';
import { addFileReplacements } from './lib/add-file-replacements';

export default async function updateBuildDir(tree: Tree) {
  const projects = getProjects(tree);
  forEachExecutorOptions<ViteBuildExecutorOptions>(
    tree,
    '@nx/vite:build',
    (options, projectName, targetName) => {
      const projectConfig = projects.get(projectName);
      const config =
        options.configFile || findViteConfig(tree, projectConfig.root);
      if (!config || !tree.exists(config)) {
        return;
      }
      let configContents = tree.read(config, 'utf-8');

      configContents = updateBuildOutDirAndRoot(
        options,
        configContents,
        projectConfig,
        targetName,
        tree,
        projectName
      );

      configContents = updateTestConfig(configContents, projectConfig);

      if (options.fileReplacements?.length > 0) {
        configContents = addFileReplacements(
          configContents,
          options.fileReplacements
        );
      }

      tree.write(config, configContents);
    }
  );

  await formatFiles(tree);
}

function findViteConfig(tree: Tree, searchRoot: string) {
  const allowsExt = ['js', 'mjs', 'ts', 'cjs', 'mts', 'cts'];

  for (const ext of allowsExt) {
    if (tree.exists(joinPathFragments(searchRoot, `vite.config.${ext}`))) {
      return joinPathFragments(searchRoot, `vite.config.${ext}`);
    }
  }
}
