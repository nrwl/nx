import { Tree } from '@angular-devkit/schematics';
import { callRule, runMigration } from '../../utils/testing';
import { readJsonInTree } from '@nrwl/workspace';
import { nxVersion } from '../../utils/versions';

describe('CLI dependency migration', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = Tree.empty();
    tree.create(
      'package.json',
      JSON.stringify({
        devDependencies: {},
      })
    );
  });

  it('should add @nrwl/cli to package.json', async () => {
    const result = await runMigration('add-cli-dependency', {}, tree);
    const packageJson = readJsonInTree(result, 'package.json');
    expect(packageJson.devDependencies['@nrwl/cli']).toEqual(nxVersion);
  });
});
