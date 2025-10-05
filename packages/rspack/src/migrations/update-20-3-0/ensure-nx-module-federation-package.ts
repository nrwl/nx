import {
  type Tree,
  readProjectConfiguration,
  addDependenciesToPackageJson,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { nxVersion } from '../../utils/versions';

export default async function ensureMfPackage(tree: Tree) {
  const projects = new Set<string>();

  forEachExecutorOptions(
    tree,
    '@nx/rspack:module-federation-dev-server',
    (options, project, target) => {
      const projectConfig = readProjectConfiguration(tree, project);
      projects.add(projectConfig.root);
    }
  );

  if (projects.size !== 0) {
    addDependenciesToPackageJson(
      tree,
      {},
      {
        '@nx/module-federation': nxVersion,
      }
    );
  }
}
