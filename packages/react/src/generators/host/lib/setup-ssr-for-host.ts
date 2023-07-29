import type { GeneratorCallback, Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  generateFiles,
  joinPathFragments,
  names,
  readProjectConfiguration,
  runTasksInSerial,
  updateProjectConfiguration,
} from '@nx/devkit';

import type { Schema } from '../schema';
import { moduleFederationNodeVersion } from '../../../utils/versions';
import { normalizeProjectName } from '../../application/lib/normalize-options';

export async function setupSsrForHost(
  tree: Tree,
  options: Schema,
  appName: string,
  defaultRemoteManifest: { name: string; port: number }[]
) {
  const tasks: GeneratorCallback[] = [];
  let project = readProjectConfiguration(tree, appName);
  project.targets.serve.executor = '@nx/react:module-federation-ssr-dev-server';
  updateProjectConfiguration(tree, appName, project);

  generateFiles(
    tree,
    joinPathFragments(__dirname, '../files/module-federation-ssr'),
    project.root,
    {
      ...options,
      remotes: defaultRemoteManifest.map(({ name, port }) => {
        const remote = normalizeProjectName({ ...options, name });
        return {
          ...names(remote),
          port,
        };
      }),
      appName,
      tmpl: '',
      browserBuildOutputPath: project.targets.build.options.outputPath,
    }
  );

  const installTask = addDependenciesToPackageJson(
    tree,
    {
      '@module-federation/node': moduleFederationNodeVersion,
    },
    {}
  );
  tasks.push(installTask);

  return runTasksInSerial(...tasks);
}
