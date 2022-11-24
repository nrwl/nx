import type { Tree } from '@nrwl/devkit';
import { readProjectConfiguration } from '@nrwl/devkit';
import { getMFProjects } from '../../../utils/get-mf-projects';

export function findNextAvailablePort(tree: Tree) {
  const mfProjects = getMFProjects(tree);

  const ports = new Set<number>([4200]);
  for (const mfProject of mfProjects) {
    const { targets } = readProjectConfiguration(tree, mfProject);
    const port = targets?.serve?.options?.port ?? 4200;
    ports.add(port);
  }

  const nextAvailablePort = Math.max(...ports) + 1;

  return nextAvailablePort;
}
