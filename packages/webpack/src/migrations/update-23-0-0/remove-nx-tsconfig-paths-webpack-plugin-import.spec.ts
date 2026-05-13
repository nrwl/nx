import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import removeNxTsconfigPathsWebpackPluginImport from './remove-nx-tsconfig-paths-webpack-plugin-import';

describe('remove-nx-tsconfig-paths-webpack-plugin-import migration', () => {
  it('rewrites single ES import to sub-path', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/webpack.config.ts',
      `import { NxTsconfigPathsWebpackPlugin } from '@nx/webpack';`
    );

    await removeNxTsconfigPathsWebpackPluginImport(tree);

    expect(tree.read('apps/my-app/webpack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { NxTsconfigPathsWebpackPlugin } from '@nx/webpack/tsconfig-paths-plugin';
      "
    `);
  });

  it('moves only the deprecated symbol when import has multiple specifiers', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/webpack.config.ts',
      `import { NxTsconfigPathsWebpackPlugin, NxAppWebpackPlugin } from '@nx/webpack';`
    );

    await removeNxTsconfigPathsWebpackPluginImport(tree);

    expect(tree.read('apps/my-app/webpack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { NxTsconfigPathsWebpackPlugin } from '@nx/webpack/tsconfig-paths-plugin';
      import { NxAppWebpackPlugin } from '@nx/webpack';
      "
    `);
  });

  it('moves only the deprecated symbol when it is last in a multi-specifier import', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/webpack.config.ts',
      `import { NxAppWebpackPlugin, NxTsconfigPathsWebpackPlugin } from '@nx/webpack';`
    );

    await removeNxTsconfigPathsWebpackPluginImport(tree);

    expect(tree.read('apps/my-app/webpack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { NxTsconfigPathsWebpackPlugin } from '@nx/webpack/tsconfig-paths-plugin';
      import { NxAppWebpackPlugin } from '@nx/webpack';
      "
    `);
  });

  it('rewrites single require() to sub-path', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/webpack.config.js',
      `const { NxTsconfigPathsWebpackPlugin } = require('@nx/webpack');`
    );

    await removeNxTsconfigPathsWebpackPluginImport(tree);

    // prettier wraps the long symbol name to multi-line
    expect(tree.read('apps/my-app/webpack.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const {
        NxTsconfigPathsWebpackPlugin,
      } = require('@nx/webpack/tsconfig-paths-plugin');
      "
    `);
  });

  it('moves only the deprecated symbol when require() has multiple bindings', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/webpack.config.js',
      `const { NxTsconfigPathsWebpackPlugin, NxAppWebpackPlugin } = require('@nx/webpack');`
    );

    await removeNxTsconfigPathsWebpackPluginImport(tree);

    // prettier wraps the long symbol name to multi-line
    expect(tree.read('apps/my-app/webpack.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const {
        NxTsconfigPathsWebpackPlugin,
      } = require('@nx/webpack/tsconfig-paths-plugin');
      const { NxAppWebpackPlugin } = require('@nx/webpack');
      "
    `);
  });

  it('does not touch files with no usage of the deprecated symbol', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const original = `const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
module.exports = { plugins: [new NxAppWebpackPlugin()] };
`;
    tree.write('apps/my-app/webpack.config.js', original);

    await removeNxTsconfigPathsWebpackPluginImport(tree);

    expect(tree.read('apps/my-app/webpack.config.js', 'utf-8')).toEqual(
      original
    );
  });

  it('is idempotent - running twice yields the same result', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/webpack.config.js',
      `const { NxTsconfigPathsWebpackPlugin } = require('@nx/webpack');`
    );

    await removeNxTsconfigPathsWebpackPluginImport(tree);
    const afterFirst = tree.read('apps/my-app/webpack.config.js', 'utf-8');

    await removeNxTsconfigPathsWebpackPluginImport(tree);
    const afterSecond = tree.read('apps/my-app/webpack.config.js', 'utf-8');

    expect(afterFirst).toEqual(afterSecond);
  });

  it('preserves alias when ES import has multiple specifiers', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/webpack.config.ts',
      `import { NxTsconfigPathsWebpackPlugin as Plugin, NxAppWebpackPlugin } from '@nx/webpack';`
    );

    await removeNxTsconfigPathsWebpackPluginImport(tree);

    expect(tree.read('apps/my-app/webpack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { NxTsconfigPathsWebpackPlugin as Plugin } from '@nx/webpack/tsconfig-paths-plugin';
      import { NxAppWebpackPlugin } from '@nx/webpack';
      "
    `);
  });

  it('preserves alias when require() has multiple bindings', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/webpack.config.js',
      `const { NxTsconfigPathsWebpackPlugin: Plugin, NxAppWebpackPlugin } = require('@nx/webpack');`
    );

    await removeNxTsconfigPathsWebpackPluginImport(tree);

    expect(tree.read('apps/my-app/webpack.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const {
        NxTsconfigPathsWebpackPlugin: Plugin,
      } = require('@nx/webpack/tsconfig-paths-plugin');
      const { NxAppWebpackPlugin } = require('@nx/webpack');
      "
    `);
  });

  it('rewrites multiple matching imports/requires in the same file', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/webpack.config.js',
      `import { NxTsconfigPathsWebpackPlugin } from '@nx/webpack';
const { NxTsconfigPathsWebpackPlugin: P2 } = require('@nx/webpack');
import { NxTsconfigPathsWebpackPlugin as P3, NxAppWebpackPlugin } from '@nx/webpack';
`
    );

    await removeNxTsconfigPathsWebpackPluginImport(tree);

    expect(tree.read('apps/my-app/webpack.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { NxTsconfigPathsWebpackPlugin as P3 } from '@nx/webpack/tsconfig-paths-plugin';
      import { NxTsconfigPathsWebpackPlugin } from '@nx/webpack/tsconfig-paths-plugin';
      const {
        NxTsconfigPathsWebpackPlugin: P2,
      } = require('@nx/webpack/tsconfig-paths-plugin');
      import { NxAppWebpackPlugin } from '@nx/webpack';
      "
    `);
  });

  it('consumes whitespace before the trailing comma in ES imports', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/webpack.config.ts',
      `import { NxTsconfigPathsWebpackPlugin , NxAppWebpackPlugin } from '@nx/webpack';`
    );

    await removeNxTsconfigPathsWebpackPluginImport(tree);

    expect(tree.read('apps/my-app/webpack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { NxTsconfigPathsWebpackPlugin } from '@nx/webpack/tsconfig-paths-plugin';
      import { NxAppWebpackPlugin } from '@nx/webpack';
      "
    `);
  });

  it('consumes whitespace before the trailing comma in CJS requires', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/webpack.config.js',
      `const { NxTsconfigPathsWebpackPlugin , NxAppWebpackPlugin } = require('@nx/webpack');`
    );

    await removeNxTsconfigPathsWebpackPluginImport(tree);

    expect(tree.read('apps/my-app/webpack.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const {
        NxTsconfigPathsWebpackPlugin,
      } = require('@nx/webpack/tsconfig-paths-plugin');
      const { NxAppWebpackPlugin } = require('@nx/webpack');
      "
    `);
  });

  it('does not modify files already using the correct sub-path import', async () => {
    const tree = createTreeWithEmptyWorkspace();
    // Use the already-prettier-formatted form so formatFiles does not change it
    const original = `const {
  NxTsconfigPathsWebpackPlugin,
} = require('@nx/webpack/tsconfig-paths-plugin');
module.exports = { plugins: [new NxTsconfigPathsWebpackPlugin()] };
`;
    tree.write('apps/my-app/webpack.config.js', original);

    await removeNxTsconfigPathsWebpackPluginImport(tree);

    expect(tree.read('apps/my-app/webpack.config.js', 'utf-8')).toEqual(
      original
    );
  });
});
