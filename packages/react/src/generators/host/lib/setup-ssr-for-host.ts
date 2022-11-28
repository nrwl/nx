import type { GeneratorCallback, Tree } from '@nrwl/devkit';
import {
  addDependenciesToPackageJson,
  generateFiles,
  joinPathFragments,
  names,
  readProjectConfiguration,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';

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
  const project = readProjectConfiguration(tree, appName);

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
