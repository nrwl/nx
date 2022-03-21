import type { Tree } from '@nrwl/devkit';
import type { Schema } from './schema';
import { getProjects, readProjectConfiguration } from '@nrwl/devkit';
import applicationGenerator from '../application/application';
import { getMfeProjects } from '../../utils/get-mfe-projects';

function findNextAvailablePort(tree: Tree) {
  const mfeProjects = getMfeProjects(tree);

  const ports = new Set<number>();
  for (const mfeProject of mfeProjects) {
    const { targets } = readProjectConfiguration(tree, mfeProject);
    const port = targets?.serve?.options?.port ?? 4200;
    ports.add(port);
  }

  const nextAvailablePort = Math.max(...ports) + 1;

  return nextAvailablePort;
}

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
    port: options.port ?? findNextAvailablePort(tree),
  });

  return installTask;
}
