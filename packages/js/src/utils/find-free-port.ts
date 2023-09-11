import { getProjects, Tree } from '@nx/devkit';

export function findFreePort(tree: Tree) {
  const projects = getProjects(tree);
  let port = -Infinity;
  for (const [, p] of projects.entries()) {
    const curr = p.targets?.serve?.options?.port;
    if (typeof curr === 'number') {
      port = Math.max(port, curr);
    }
  }
  return port > 0 ? port + 1 : 4200;
}
