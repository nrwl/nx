import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addProjectConfiguration, Tree, writeJson } from '@nx/devkit';

import update from './generator';
import { setCwd } from '@nx/devkit/internal-testing-utils';

describe('remove-migrations generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'js', {
      root: 'packages/js',
      targets: {
        build: {},
      },
    });

    jest.spyOn(process, 'cwd').mockReturnValue('/virtual/packages/js');

    setCwd('packages/js');
  });

  it('should remove migrations older than specified version', async () => {
    writeJson(tree, 'packages/js/package.json', {
      'nx-migrations': {
        migrations: './migrations.json',
      },
    });
    writeJson(tree, 'packages/js/migrations.json', {
      generators: {
        'update-99-0-0-remove': {
          cli: 'nx',
          version: '99.0.0-beta.0',
          implementation: './src/migrations/update-99-0-0/remove',
        },
        'update-100-0-0-keep': {
          cli: 'nx',
          version: '100.0.0-beta.0',
          implementation: './src/migrations/update-100-0-0/keep',
        },
      },
    });
    tree.write(
      'packages/js/src/migrations/update-99-0-0/__snapshots__/remove.spec.ts.snap',
      ''
    );
    tree.write('packages/js/src/migrations/update-99-0-0/helpers.ts', '');
    tree.write('packages/js/src/migrations/update-99-0-0/remove.ts', '');
    tree.write('packages/js/src/migrations/update-99-0-0/remove.spec.ts', '');
    tree.write(
      'packages/js/src/migrations/update-100-0-0/__snapshots__/keep.spec.ts.snap',
      ''
    );
    tree.write('packages/js/src/migrations/update-100-0-0/keep.spec.ts', '');
    tree.write('packages/js/src/migrations/update-100-0-0/keep.ts', '');

    await update(tree, { v: 100 });

    expect(
      tree.exists(
        'packages/js/src/migrations/update-99-0-0/__snapshots__/remove.spec.ts.snap'
      )
    ).toBeFalsy();
    expect(
      tree.exists('packages/js/src/migrations/update-99-0-0/remove.ts')
    ).toBeFalsy();
    expect(
      tree.exists('packages/js/src/migrations/update-99-0-0/helpers.ts')
    ).toBeFalsy();
    expect(
      tree.exists('packages/js/src/migrations/update-99-0-0/remove.spec.ts')
    ).toBeFalsy();
    expect(
      tree.exists(
        'packages/js/src/migrations/update-100-0-0/__snapshots__/keep.spec.ts.snap'
      )
    ).toBeTruthy();
    expect(
      tree.exists('packages/js/src/migrations/update-100-0-0/keep.spec.ts')
    ).toBeTruthy();
    expect(
      tree.exists('packages/js/src/migrations/update-100-0-0/keep.ts')
    ).toBeTruthy();
  });
});
