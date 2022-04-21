import { formatFiles, names, Tree } from '@nrwl/devkit';
import type { Schema } from './schema';

import { getProjects } from '@nrwl/devkit';
import applicationGenerator from '../application/application';
import remoteGenerator from '../remote/remote';
import { normalizeProjectName } from '../utils/project';

export default async function host(tree: Tree, options: Schema) {
  const projects = getProjects(tree);

  const remotesToGenerate: string[] = [];
  const remotesToIntegrate: string[] = [];

  if (options.remotes && options.remotes.length > 0) {
    options.remotes.forEach((remote) => {
      if (!projects.has(remote)) {
        remotesToGenerate.push(remote);
      } else {
        remotesToIntegrate.push(remote);
      }
    });
  }

  const installTask = await applicationGenerator(tree, {
    ...options,
    mfe: true,
    mfeType: 'host',
    routing: true,
    remotes: remotesToIntegrate ?? [],
    port: 4200,
    federationType: options.dynamic ? 'dynamic' : 'static',
    skipFormat: true,
  });

  for (const remote of remotesToGenerate) {
    await remoteGenerator(tree, {
      ...options,
      name: remote,
      host: normalizeProjectName(options.name, options.directory),
      skipFormat: true,
    });
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}
