import {
  type Tree,
  createProjectGraphAsync,
  ProjectConfiguration,
} from '@nx/devkit';
import { migrateExecutorToPlugin } from '@nx/devkit/src/generators/plugin-migrations/executor-to-plugin-migrator';
import { createNodes, WebpackPluginOptions } from '../../plugins/plugin';
import { buildPostTargetTransformer } from './lib/build-post-target-transformer';

interface Schema {
  project?: string;
  skipFormat?: boolean;
}

function hasAnotherWebpackConfig(
  file: string,
  projectJsonString: string,
  tree: Tree,
  projectRoot: string
) {
  return (
    file !== 'webpack.config.js' &&
    file.endsWith('.js') &&
    file.includes('webpack.config') &&
    projectJsonString.includes(file) &&
    tree.exists(`${projectRoot}/webpack.config.js`)
  );
}

export async function convertToInferred(tree: Tree, options: Schema) {
  const projectGraph = await createProjectGraphAsync();

  const projectRoot = projectGraph.nodes[options.project].data.root;
  const projectJsonString = tree.read(`${projectRoot}/project.json`, 'utf-8');
  const projectJson: ProjectConfiguration = JSON.parse(projectJsonString);
  const containsMfeExecutor = Object.keys(projectJson.targets).some(
    (target) => {
      return [
        '@nx/react:module-federation-dev-server',
        '@nx/angular:module-federation-dev-server',
      ].includes(projectJson.targets[target].executor);
    }
  );

  if (containsMfeExecutor) {
    throw new Error(
      'Cannot convert a project using a module federation executor because the executor options are not compatible with Crystal'
    );
  }

  const files = tree.children(projectGraph.nodes[options.project].data.root);

  for (const file of files) {
    if (hasAnotherWebpackConfig(file, projectJsonString, tree, projectRoot)) {
      throw new Error(
        'Cannot convert a project with multiple webpack config files to inferred'
      );
    }
  }

  // tree.rename(`${projectRoot}/webpack.config.js`, `${projectRoot}/webpack.config.custom.js`);

  const migratedBuildTarget =
    await migrateExecutorToPlugin<WebpackPluginOptions>(
      tree,
      projectGraph,
      '@nx/webpack:webpack',
      '@nx/webpack/plugin',
      (targetName) => ({
        buildTargetName: targetName,
        serveTargetName: 'serve',
        previewTargetName: 'preview',
        serveStaticTargetName: 'serve-static',
      }),
      buildPostTargetTransformer,
      createNodes,
      options.project
    );
}
