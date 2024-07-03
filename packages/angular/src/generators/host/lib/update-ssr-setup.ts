import type { Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import { join } from 'path';
import {
  corsVersion,
  moduleFederationNodeVersion,
  typesCorsVersion,
} from '../../../utils/versions';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { Schema } from '../schema';

export async function updateSsrSetup(
  tree: Tree,
  options: Schema,
  appName: string,
  typescriptConfiguration: boolean
) {
  let project = readProjectConfiguration(tree, appName);

  tree.rename(
    joinPathFragments(project.sourceRoot, 'main.server.ts'),
    joinPathFragments(project.sourceRoot, 'bootstrap.server.ts')
  );
  tree.write(
    joinPathFragments(project.root, 'server.ts'),
    "import('./src/main.server');"
  );

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  generateFiles(
    tree,
    join(
      __dirname,
      '../files/common',
      angularMajorVersion >= 17 ? 'v17+' : 'pre-v17'
    ),
    project.root,
    {
      appName,
      browserBundleOutput: project.targets.build.options.outputPath,
      standalone: options.standalone,
      tmpl: '',
    }
  );

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
