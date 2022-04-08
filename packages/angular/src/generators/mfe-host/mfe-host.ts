import type { Tree } from '@nrwl/devkit';
import type { Schema } from './schema';

import { getProjects } from '@nrwl/devkit';
import applicationGenerator from '../application/application';

export default async function mfeHost(tree: Tree, options: Schema) {
  const projects = getProjects(tree);

  if (options.remotes && options.remotes.length > 0) {
    options.remotes.forEach((remote) => {
      if (!projects.has(remote)) {
        throw new Error(
          `Could not find specified remote application (${remote})`
        );
      }
    });
  }

  const installTask = await applicationGenerator(tree, {
    ...options,
    mfe: true,
    mfeType: 'host',
    routing: true,
    remotes: options.remotes ?? [],
    port: 4200,
    federationType: options.dynamic ? 'dynamic' : 'static',
  });

  return installTask;
}
