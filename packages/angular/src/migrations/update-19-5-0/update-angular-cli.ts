import {
  addDependenciesToPackageJson,
  formatFiles,
  readJson,
  Tree,
} from '@nx/devkit';

export const angularCliVersion = '~18.1.0';

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
