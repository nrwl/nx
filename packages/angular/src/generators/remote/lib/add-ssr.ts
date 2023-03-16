import type { Tree } from '@nrwl/devkit';
import {
  addDependenciesToPackageJson,
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';

import setupSsr from '../../setup-ssr/setup-ssr';
import {
  corsVersion,
  expressVersion,
  moduleFederationNodeVersion,
  typesCorsVersion,
  typesExpressVersion,
} from '../../../utils/versions';

export async function addSsr(
  tree: Tree,
  { appName, port }: { appName: string; port: number }
) {
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
  project.targets['serve-ssr'].options = {
    ...(project.targets['serve-ssr'].options ?? {}),
    port,
  };

  project.targets['static-server'] = {
    dependsOn: ['build', 'server'],
    executor: 'nx:run-commands',
    options: {
      command: `PORT=${port} node ${joinPathFragments(
        project.targets.server.options.outputPath,
        'main.js'
      )}`,
    },
  };

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
