import {
  formatFiles,
  updateJson,
  type Tree,
  type GeneratorCallback,
} from '@nx/devkit';
import { subset, validRange } from 'semver';

const PINS: Record<string, string> = {
  jest: '~30.3.0',
  'babel-jest': '~30.3.0',
  '@types/jest': '~30.0.0',
};

const RANGE_30 = '>=30.0.0 <31.0.0';

export default async function update(tree: Tree): Promise<GeneratorCallback> {
  const rootPackageJsonPath = 'package.json';
  if (!tree.exists(rootPackageJsonPath)) {
    return () => {};
  }

  let mutated = false;
  updateJson(tree, rootPackageJsonPath, (json) => {
    mutated = pinSection(json, 'dependencies') || mutated;
    mutated = pinSection(json, 'devDependencies') || mutated;
    return json;
  });

  if (mutated) {
    await formatFiles(tree);
  }
  return () => {};
}

function pinSection(
  json: Record<string, any>,
  section: 'dependencies' | 'devDependencies'
): boolean {
  const deps = json[section];
  if (!deps) return false;
  let mutated = false;
  for (const [pkg, pinned] of Object.entries(PINS)) {
    const current = deps[pkg];
    if (!current || current === pinned) continue;
    if (!validRange(current)) continue; // skip file:, github:, etc.
    if (!subset(current, RANGE_30)) continue; // skip ranges that escape major 30
    deps[pkg] = pinned;
    mutated = true;
  }
  return mutated;
}
