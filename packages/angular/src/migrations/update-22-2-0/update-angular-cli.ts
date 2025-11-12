import {
  addDependenciesToPackageJson,
  formatFiles,
  readJson,
  type Tree,
} from '@nx/devkit';

export const angularCliVersion = '21.0.0-rc.4';

export default async function (tree: Tree) {
  const { devDependencies, dependencies } = readJson(tree, 'package.json');
  const hasAngularCli =
    devDependencies?.['@angular/cli'] || dependencies?.['@angular/cli'];

  if (hasAngularCli) {
    addDependenciesToPackageJson(
      tree,
      {},
      { '@angular/cli': angularCliVersion }
    );
    await formatFiles(tree);
  }
}
