import { existsSync } from 'fs';
import { dirname, isAbsolute, join, resolve } from 'path';

export function findAncestorNodeModules(startPath, collector) {
  let currentPath = isAbsolute(startPath) ? startPath : resolve(startPath);

  while (currentPath !== dirname(currentPath)) {
    const potentialNodeModules = join(currentPath, 'node_modules');
    if (existsSync(potentialNodeModules)) {
      collector.push(potentialNodeModules);
    }

    if (existsSync(join(currentPath, 'nx.json'))) {
      break;
    }

    currentPath = dirname(currentPath);
  }

  return collector;
}
