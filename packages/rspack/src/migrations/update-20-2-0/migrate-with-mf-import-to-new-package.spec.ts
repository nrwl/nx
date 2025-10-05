import { type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migrateWithMfImport from './migrate-with-mf-import-to-new-package';

describe('migrate-with-mf-import-to-new-package', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/shell/project.json',
      JSON.stringify({
        name: 'shell',
        root: 'apps/shell',
        sourceRoot: 'apps/shell/src',
        projectType: 'application',
        targets: {
          serve: {
            executor: '@nx/rspack:module-federation-dev-server',
            options: {},
          },
        },
      })
    );
  });

  it('should migrate the import correctly for withMf', async () => {
    // ARRANGE
    tree.write(
      'apps/shell/rspack.config.ts',
      `import { withModuleFederation } from '@nx/rspack/module-federation';`
    );

    // ACT
    await migrateWithMfImport(tree);

    // ASSERT
    expect(tree.read('apps/shell/rspack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { withModuleFederation } from '@nx/module-federation/rspack';
      "
    `);
  });

  it('should migrate the require correctly for withMf', async () => {
    // ARRANGE
    tree.write(
      'apps/shell/rspack.config.js',
      `const { withModuleFederation } = require('@nx/rspack/module-federation');`
    );

    // ACT
    await migrateWithMfImport(tree);

    // ASSERT
    expect(tree.read('apps/shell/rspack.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { withModuleFederation } = require('@nx/module-federation/rspack');
      "
    `);
  });

  it('should migrate the import correctly for withMfSSR', async () => {
    // ARRANGE
    tree.write(
      'apps/shell/webpack.config.ts',
      `import { withModuleFederationForSSR } from '@nx/rspack/module-federation';`
    );

    // ACT
    await migrateWithMfImport(tree);

    // ASSERT
    expect(tree.read('apps/shell/webpack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { withModuleFederationForSSR } from '@nx/module-federation/rspack';
      "
    `);
  });

  it('should migrate the require correctly for withMfSSR', async () => {
    // ARRANGE
    tree.write(
      'apps/shell/rspack.config.js',
      `const { withModuleFederationForSSR } = require('@nx/rspack/module-federation');`
    );

    // ACT
    await migrateWithMfImport(tree);

    // ASSERT
    expect(tree.read('apps/shell/rspack.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { withModuleFederationForSSR } = require('@nx/module-federation/rspack');
      "
    `);
  });

  describe('idempotent', () => {
    it('should migrate the import correctly for withMf even when run twice', async () => {
      // ARRANGE
      tree.write(
        'apps/shell/webpack.config.ts',
        `import { withModuleFederation } from '@nx/rspack/module-federation';`
      );

      // ACT
      await migrateWithMfImport(tree);
      await migrateWithMfImport(tree);

      // ASSERT
      expect(tree.read('apps/shell/webpack.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { withModuleFederation } from '@nx/module-federation/rspack';
        "
      `);
    });

    it('should migrate the require correctly for withMfSSR even when run twice', async () => {
      // ARRANGE
      tree.write(
        'apps/shell/rspack.config.js',
        `const { withModuleFederationForSSR } = require('@nx/rspack/module-federation');`
      );

      // ACT
      await migrateWithMfImport(tree);
      await migrateWithMfImport(tree);

      // ASSERT
      expect(tree.read('apps/shell/rspack.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withModuleFederationForSSR } = require('@nx/module-federation/rspack');
        "
      `);
    });
  });
});
