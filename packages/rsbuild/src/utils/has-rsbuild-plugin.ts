import { type Tree, readNxJson } from '@nx/devkit';
import picomatch from 'picomatch';

export function hasRsbuildPlugin(tree: Tree, projectPath?: string) {
  const nxJson = readNxJson(tree);
  if (!projectPath) {
    return !!nxJson.plugins?.some((p) =>
      typeof p === 'string' ? p === '@nx/rsbuild' : p.plugin === '@nx/rsbuild'
    );
  }
  // projectPath is a directory, not a file: `strictSlashes` keeps `<root>/**`
  // from matching `<root>` itself, as minimatch did
  const matchesProject = (pattern: string) =>
    picomatch.isMatch(projectPath, pattern, { strictSlashes: true });

  return !!nxJson.plugins?.some((p) => {
    if (typeof p === 'string') {
      return p === '@nx/rsbuild';
    }
    if (p.exclude) {
      for (const exclude of p.exclude) {
        if (matchesProject(exclude)) {
          return false;
        }
      }
    }
    if (p.include) {
      for (const include of p.include) {
        if (matchesProject(include)) {
          return true;
        }
      }
    }

    // if no include or exclude, then it's a match
    return true;
  });
}
