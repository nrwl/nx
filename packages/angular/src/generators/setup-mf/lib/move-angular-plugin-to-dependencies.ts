import { readJson, writeJson, type Tree } from '@nx/devkit';

export function moveAngularPluginToDependencies(tree: Tree): void {
  const packageJson = readJson(tree, 'package.json');
  if (packageJson.dependencies?.['@nx/angular']) {
    return;
  }

  packageJson.dependencies ??= {};
  packageJson.dependencies['@nx/angular'] =
    packageJson.devDependencies['@nx/angular'];
  delete packageJson.devDependencies['@nx/angular'];

  writeJson(tree, 'package.json', packageJson);
}
