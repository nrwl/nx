import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree } from '@nrwl/workspace';

import { runMigration } from '../../utils/testing';

describe('Update 11-0-12', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = Tree.empty();
  });

  it('should update storybook versions if storybook is already above 6', async () => {
    tree.create(
      'package.json',
      JSON.stringify({
        devDependencies: {
          '@storybook/angular': '^6.0.0',
          '@storybook/react': '^6.0.0',
          '@storybook/addon-knobs': '^6.0.0',
        },
      })
    );
    const result = await runMigration('update-11-0-12', {}, tree);
    expect(
      readJsonInTree(result, 'package.json').devDependencies[
        '@storybook/angular'
      ]
    ).toBe('^6.1.11');
  });

  it('should not update storybook versions if storybook is below 6', async () => {
    tree.create(
      'package.json',
      JSON.stringify({
        devDependencies: {
          '@storybook/angular': '^5.0.0',
          '@storybook/react': '^5.0.0',
          '@storybook/addon-knobs': '^5.0.0',
        },
      })
    );
    const result = await runMigration('update-11-0-12', {}, tree);
    expect(
      readJsonInTree(result, 'package.json').devDependencies[
        '@storybook/angular'
      ]
    ).toBe('^5.0.0');
  });
});
