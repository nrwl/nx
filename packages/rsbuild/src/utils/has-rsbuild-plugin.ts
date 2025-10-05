import { type Tree, readNxJson } from '@nx/devkit';
import { minimatch } from 'minimatch';

export function hasRsbuildPlugin(tree: Tree, projectPath?: string) {
  const nxJson = readNxJson(tree);
  if (!projectPath) {
    return !!nxJson.plugins?.some((p) =>
      typeof p === 'string' ? p === '@nx/rsbuild' : p.plugin === '@nx/rsbuild'
    );
  }
  return !!nxJson.plugins?.some((p) => {
    if (typeof p === 'string') {
      return p === '@nx/rsbuild';
    }
    if (p.exclude) {
      for (const exclude of p.exclude) {
        if (minimatch(projectPath, exclude)) {
          return false;
        }
      }
    }
    if (p.include) {
      for (const include of p.include) {
        if (minimatch(projectPath, include)) {
          return true;
        }
      }
    }

    // if no include or exclude, then it's a match
    return true;
  });
}
