import { readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { sassVersion } from '../../utils/versions';
import update from './replace-node-sass-with-sass-12-6-1';

describe('Replace node-sass with sass to dev dependencies 12.6.1', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it(`should replace node-sass with sass if gatsby-plugin-sass is in devDependencies`, async () => {
    tree.write(
      'package.json',
      JSON.stringify({
        dependencies: {},
        devDependencies: { 'node-sass': '*', 'gatsby-plugin-sass': '*' },
      })
    );

    await update(tree);

    const devDependencies = readJson(tree, 'package.json').devDependencies;
    expect(devDependencies['sass']).toEqual(sassVersion);
    expect(devDependencies['node-sass']).toBeUndefined();
  });

  it(`should not replace node-sass with sass if gatsby-plugin-sass is not in devDependencies`, async () => {
    tree.write(
      'package.json',
      JSON.stringify({
        dependencies: {},
        devDependencies: { 'node-sass': '*' },
      })
    );

    await update(tree);

    const devDependencies = readJson(tree, 'package.json').devDependencies;
    expect(devDependencies['sass']).toBeUndefined();
    expect(devDependencies['node-sass']).toBeDefined();
  });
});
