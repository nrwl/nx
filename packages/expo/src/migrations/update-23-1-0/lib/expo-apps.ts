import { Tree, getProjects, joinPathFragments, readJson } from '@nx/devkit';

/**
 * Returns the project roots of every Expo application in the workspace.
 * An Expo project is detected by an `expo` entry in its (or the root)
 * package.json.
 */
export function getExpoAppRoots(tree: Tree): string[] {
  const roots: string[] = [];
  for (const [, config] of getProjects(tree)) {
    if (config.projectType !== 'application') {
      continue;
    }
    if (isExpoProject(tree, config.root)) {
      roots.push(config.root);
    }
  }
  return roots;
}

function isExpoProject(tree: Tree, projectRoot: string): boolean {
  // Newer Expo apps declare deps as `*` and pin them at the workspace root, so
  // check both the project package.json and the root package.json.
  for (const dir of [projectRoot, '']) {
    const packageJsonPath = joinPathFragments(dir, 'package.json');
    if (!tree.exists(packageJsonPath)) {
      continue;
    }
    try {
      const packageJson = readJson(tree, packageJsonPath);
      if (packageJson.dependencies?.expo || packageJson.devDependencies?.expo) {
        return true;
      }
    } catch {
      // ignore malformed package.json
    }
  }
  return false;
}
