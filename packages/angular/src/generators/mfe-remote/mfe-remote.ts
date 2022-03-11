import type { Tree } from '@nrwl/devkit';
import type { Schema } from './schema';
import { getProjects } from '@nrwl/devkit';
import applicationGenerator from '../application/application';

export default async function mfeRemote(tree: Tree, options: Schema) {
  const projects = getProjects(tree);
  if (options.host && !projects.has(options.host)) {
    throw new Error(
      `The name of the application to be used as the host app does not exist. (${options.host})`
    );
  }

  const installTask = await applicationGenerator(tree, {
    name: options.name,
    mfe: true,
    mfeType: 'remote',
    routing: true,
    host: options.host,
    port: options.port ?? 4200,
  });

  return installTask;
}
