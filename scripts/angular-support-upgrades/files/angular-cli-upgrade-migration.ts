export const getAngularCliMigrationGenerator = (
  version: string
) => `import { formatFiles, Tree, updateJson } from '@nrwl/devkit';

const angularCliVersion = '~${version}';

export default async function (tree: Tree) {
  let shouldFormat = false;

  updateJson(tree, 'package.json', (json) => {
    if (json.devDependencies?.['@angular/cli']) {
      json.devDependencies['@angular/cli'] = angularCliVersion;
      shouldFormat = true;
    } else if (json.dependencies?.['@angular/cli']) {
      json.dependencies['@angular/cli'] = angularCliVersion;
      shouldFormat = true;
    }

    return json;
  });

  if (shouldFormat) {
    await formatFiles(tree);
  }
}
`;

export const getAngularCliMigrationGeneratorSpec = (
  version: string
) => `import { readJson, Tree, writeJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import updateAngularCli from './update-angular-cli';

describe('update-angular-cli migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should update @angular/cli version when defined as a dev dependency', async () => {
    writeJson(tree, 'package.json', {
      devDependencies: { '@angular/cli': '~13.3.0' },
    });

    await updateAngularCli(tree);

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['@angular/cli']).toEqual('~${version}');
  });

  it('should update @angular/cli version when defined as a dependency', async () => {
    writeJson(tree, 'package.json', {
      dependencies: { '@angular/cli': '~13.3.0' },
    });

    await updateAngularCli(tree);

    const { dependencies } = readJson(tree, 'package.json');
    expect(dependencies['@angular/cli']).toEqual('~${version}');
  });

  it('should add @angular/cli to package.json when it is not set', async () => {
    const initialPackageJson = readJson(tree, 'package.json');

    await updateAngularCli(tree);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toStrictEqual(initialPackageJson);
  });
});
`;
