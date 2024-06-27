import type { Tree } from '@nx/devkit';
import {
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import type { Schema } from '../schema';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';

export function setupHostIfDynamic(tree: Tree, options: Schema) {
  if (options.federationType === 'static') {
    return;
  }

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  const project = readProjectConfiguration(tree, options.appName);
  const pathToMFManifest =
    angularMajorVersion >= 18
      ? joinPathFragments(
          project.root,
          'public/module-federation.manifest.json'
        )
      : joinPathFragments(
          project.sourceRoot,
          'assets/module-federation.manifest.json'
        );

  if (!tree.exists(pathToMFManifest)) {
    tree.write(pathToMFManifest, '{}');
  }

  const pathToProdWebpackConfig = joinPathFragments(
    project.root,
    `webpack.prod.config.${options.typescriptConfiguration ? 'ts' : 'js'}`
  );
  if (tree.exists(pathToProdWebpackConfig)) {
    tree.delete(pathToProdWebpackConfig);
  }

  delete project.targets.build.configurations.production?.customWebpackConfig;

  updateProjectConfiguration(tree, options.appName, project);
}
