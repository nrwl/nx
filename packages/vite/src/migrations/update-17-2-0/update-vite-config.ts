import {
  Tree,
  formatFiles,
  getProjects,
  joinPathFragments,
  logger,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { ViteBuildExecutorOptions } from '../../executors/build/schema';
import { updateBuildOutDirAndRoot } from './lib/edit-build-config';
import { updateTestConfig } from './lib/edit-test-config';
import { addFileReplacements } from './lib/add-file-replacements';
import { tsquery } from '@phenomnomnominal/tsquery';
import ts = require('typescript');
import { findViteConfig } from '../../utils/find-vite-config';

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
        projectName,
        config
      );

      configContents = updateTestConfig(configContents, projectConfig, config);

      if (options['fileReplacements']?.length > 0) {
        configContents = addFileReplacements(
          configContents,
          options['fileReplacements'],
          config
        );
      }

      tree.write(config, configContents);
    }
  );

  await formatFiles(tree);
}

export function getConfigNode(configFileContents: string): ts.Node | undefined {
  if (!configFileContents) {
    return;
  }
  let configNode = tsquery.query(
    configFileContents,
    `CallExpression:has(Identifier[name=defineConfig]) > ObjectLiteralExpression`
  )?.[0];

  if (!configNode) {
    const arrowFunctionReturnStatement = tsquery.query(
      configFileContents,
      `ArrowFunction Block ReturnStatement ObjectLiteralExpression`
    )?.[0];

    if (arrowFunctionReturnStatement) {
      configNode = arrowFunctionReturnStatement;
    }
  }

  return configNode;
}

export function notFoundWarning(configPath: string) {
  logger.warn(`
  Could not migrate your ${configPath} file.
  Please add the build.outDir and root options in your ${configPath} file.
  You can find more information on how to configure vite for Nx here:
  
  https://nx.dev/recipes/vite/configure-vite
  `);
}
