import type { Tree } from '@nrwl/devkit';
import {
  addDependenciesToPackageJson,
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import type { Schema } from '../schema';

import setupSsr from '../../setup-ssr/setup-ssr';
import {
  corsVersion,
  expressVersion,
  moduleFederationNodeVersion,
  typesCorsVersion,
  typesExpressVersion,
} from '../../../utils/versions';

export async function addSsr(tree: Tree, options: Schema, appName: string) {
  let project = readProjectConfiguration(tree, appName);

  await setupSsr(tree, {
    project: appName,
  });

  tree.rename(
    joinPathFragments(project.sourceRoot, 'main.server.ts'),
    joinPathFragments(project.sourceRoot, 'bootstrap.server.ts')
  );
  tree.write(
    joinPathFragments(project.root, 'server.ts'),
    "import('./src/main.server');"
  );

  tree.rename(
    joinPathFragments(project.sourceRoot, 'main.ts'),
    joinPathFragments(project.sourceRoot, 'bootstrap.ts')
  );
  tree.write(
    joinPathFragments(project.sourceRoot, 'main.ts'),
    `import("./bootstrap")`
  );

  generateFiles(tree, joinPathFragments(__dirname, '../files'), project.root, {
    appName,
    tmpl: '',
  });

  // update project.json
  project = readProjectConfiguration(tree, appName);

  project.targets.server.executor = '@nrwl/angular:webpack-server';
  project.targets.server.options.customWebpackConfig = {
    path: joinPathFragments(project.root, 'webpack.server.config.js'),
  };

  project.targets['serve-ssr'].executor =
    '@nrwl/angular:module-federation-dev-ssr';

  updateProjectConfiguration(tree, appName, project);

  const installTask = addDependenciesToPackageJson(
    tree,
    {
      cors: corsVersion,
      express: expressVersion,
      '@module-federation/node': moduleFederationNodeVersion,
    },
    {
      '@types/cors': typesCorsVersion,
      '@types/express': typesExpressVersion,
    }
  );

  return installTask;
}
