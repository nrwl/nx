import type { GeneratorCallback, Tree } from '@nrwl/devkit';
import {
  addDependenciesToPackageJson,
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';

import { NormalizedSchema } from '../../application/schema';
import type { Schema } from '../schema';
import { moduleFederationNodeVersion } from '../../../utils/versions';

export async function setupSsrForRemote(
  tree: Tree,
  options: NormalizedSchema<Schema>,
  appName: string
) {
  const tasks: GeneratorCallback[] = [];
  const project = readProjectConfiguration(tree, appName);

  generateFiles(
    tree,
    joinPathFragments(__dirname, '../files/module-federation-ssr'),
    project.root,
    {
      ...options,
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
