import { readNxJson } from '@nx/devkit';
import { Tree } from '@nx/devkit';

export function hasMavenPlugin(tree: Tree): boolean {
  const nxJson = readNxJson(tree);
  return !!nxJson.plugins?.some(
    (plugin) =>
      typeof plugin === 'object' &&
      plugin.plugin === '@nx/maven'
  );
} 