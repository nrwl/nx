import * as path from 'path';
import { getPackageConfigurations } from './get-package-configurations';
import { generateFile, getNxPackageDependencies } from './utils';
import { dedent } from 'tslint/lib/utils';

/**
 * @TODO: Generate home for each packages
 *   and link them to the api home.
 */

let template = dedent`
# API

Here is the list of all the available packages inside the Nx ecosystem. You
can see, for each package its dependencies.

| PackageName | Dependencies | PeerDependencies |
| ----------- | ------------ | ---------------- |
`;

getPackageConfigurations()
  .filter(item => item.hasBuilders || item.hasSchematics)
  .map(item => {
    const dependencies = getNxPackageDependencies(
      path.join(item.root, 'package.json')
    );

    const data = Object.assign(
      {},
      {
        hasBuilders: item.hasBuilders,
        hasSchematics: item.hasSchematics
      },
      dependencies
    );

    template += dedent`| ${data.name} | ${data.dependencies.join(
      ', '
    )} | ${data.peerDependencies.join(', ')} |\n`;
  });

generateFile(path.join(__dirname, '../../docs', 'api'), {
  name: 'home',
  template
});
console.log('Done generating API Home Documentation');
