import type { Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import { getProjectSourceRoot } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { join } from 'path';
import {
  corsVersion,
  moduleFederationNodeVersion,
  typesCorsVersion,
} from '../../../utils/versions';
import type { Schema } from '../schema';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';

export async function updateSsrSetup(
  tree: Tree,
  options: Schema,
  appName: string,
  typescriptConfiguration: boolean
) {
  let project = readProjectConfiguration(tree, appName);
  const sourceRoot = getProjectSourceRoot(project, tree);

  tree.rename(
    joinPathFragments(sourceRoot, 'main.server.ts'),
    joinPathFragments(sourceRoot, 'bootstrap.server.ts')
  );
  const pathToServerEntry = joinPathFragments(sourceRoot, 'server.ts');
  tree.write(pathToServerEntry, `import('./main.server');`);

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  generateFiles(tree, join(__dirname, '../files/common'), project.root, {
    appName,
    browserBundleOutput: project.targets.build.options.outputPath,
    standalone: options.standalone,
    zoneless: options.zoneless,
    useDefaultImport: angularMajorVersion >= 21,
    angularMajorVersion,
    tmpl: '',
  });

  const pathToTemplateFiles = typescriptConfiguration ? 'ts' : 'js';

  generateFiles(
    tree,
    join(__dirname, '../files', pathToTemplateFiles),
    project.root,
    {
      tmpl: '',
    }
  );

  // update project.json
  project = readProjectConfiguration(tree, appName);

  project.targets.server.executor = '@nx/angular:webpack-server';
  project.targets.server.options.customWebpackConfig = {
    path: joinPathFragments(
      project.root,
      `webpack.server.config.${pathToTemplateFiles}`
    ),
  };

  if (
    project.targets.server.configurations &&
    project.targets.server.configurations.development
  ) {
    if ('vendorChunk' in project.targets.server.configurations.development) {
      delete project.targets.server.configurations.development.vendorChunk;
    }
  }

  project.targets['serve-ssr'].executor =
    '@nx/angular:module-federation-dev-ssr';

  updateProjectConfiguration(tree, appName, project);

  if (!options.skipPackageJson) {
    return addDependenciesToPackageJson(
      tree,
      {
        cors: corsVersion,
        '@module-federation/node': moduleFederationNodeVersion,
      },
      {
        '@types/cors': typesCorsVersion,
      }
    );
  }

  return () => {};
}
