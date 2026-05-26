import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import removeNxReactWebpackPluginImport from './remove-nx-react-webpack-plugin-import';

describe('remove-nx-react-webpack-plugin-import migration', () => {
  it('rewrites single ES import to sub-path', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/webpack.config.ts',
      `import { NxReactWebpackPlugin } from '@nx/react';`
    );

    await removeNxReactWebpackPluginImport(tree);

    expect(tree.read('apps/my-app/webpack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { NxReactWebpackPlugin } from '@nx/react/webpack-plugin';
      "
    `);
  });

  it('moves only the deprecated symbol when import has multiple specifiers', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/webpack.config.ts',
      `import { NxReactWebpackPlugin, withReact } from '@nx/react';`
    );

    await removeNxReactWebpackPluginImport(tree);

    expect(tree.read('apps/my-app/webpack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { NxReactWebpackPlugin } from '@nx/react/webpack-plugin';
      import { withReact } from '@nx/react';
      "
    `);
  });

  it('moves only the deprecated symbol when it is last in a multi-specifier import', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/webpack.config.ts',
      `import { withReact, NxReactWebpackPlugin } from '@nx/react';`
    );

    await removeNxReactWebpackPluginImport(tree);

    expect(tree.read('apps/my-app/webpack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { NxReactWebpackPlugin } from '@nx/react/webpack-plugin';
      import { withReact } from '@nx/react';
      "
    `);
  });

  it('rewrites single require() to sub-path', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/webpack.config.js',
      `const { NxReactWebpackPlugin } = require('@nx/react');`
    );

    await removeNxReactWebpackPluginImport(tree);

    expect(tree.read('apps/my-app/webpack.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
      "
    `);
  });

  it('moves only the deprecated symbol when require() has multiple bindings', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/webpack.config.js',
      `const { NxReactWebpackPlugin, withReact } = require('@nx/react');`
    );

    await removeNxReactWebpackPluginImport(tree);

    expect(tree.read('apps/my-app/webpack.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
      const { withReact } = require('@nx/react');
      "
    `);
  });

  it('does not touch files with no usage of the deprecated symbol', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const original = `const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
module.exports = { plugins: [new NxAppWebpackPlugin()] };
`;
    tree.write('apps/my-app/webpack.config.js', original);

    await removeNxReactWebpackPluginImport(tree);

    expect(tree.read('apps/my-app/webpack.config.js', 'utf-8')).toEqual(
      original
    );
  });

  it('is idempotent - running twice yields the same result', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/webpack.config.js',
      `const { NxReactWebpackPlugin } = require('@nx/react');`
    );

    await removeNxReactWebpackPluginImport(tree);
    const afterFirst = tree.read('apps/my-app/webpack.config.js', 'utf-8');

    await removeNxReactWebpackPluginImport(tree);
    const afterSecond = tree.read('apps/my-app/webpack.config.js', 'utf-8');

    expect(afterFirst).toEqual(afterSecond);
  });

  it('preserves alias when ES import has multiple specifiers', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/webpack.config.ts',
      `import { NxReactWebpackPlugin as Plugin, withReact } from '@nx/react';`
    );

    await removeNxReactWebpackPluginImport(tree);

    expect(tree.read('apps/my-app/webpack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { NxReactWebpackPlugin as Plugin } from '@nx/react/webpack-plugin';
      import { withReact } from '@nx/react';
      "
    `);
  });

  it('preserves alias when require() has multiple bindings', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/webpack.config.js',
      `const { NxReactWebpackPlugin: Plugin, withReact } = require('@nx/react');`
    );

    await removeNxReactWebpackPluginImport(tree);

    expect(tree.read('apps/my-app/webpack.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { NxReactWebpackPlugin: Plugin } = require('@nx/react/webpack-plugin');
      const { withReact } = require('@nx/react');
      "
    `);
  });

  it('rewrites multiple matching imports/requires in the same file', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/webpack.config.js',
      `import { NxReactWebpackPlugin } from '@nx/react';
const { NxReactWebpackPlugin: P2 } = require('@nx/react');
import { NxReactWebpackPlugin as P3, withReact } from '@nx/react';
`
    );

    await removeNxReactWebpackPluginImport(tree);

    expect(tree.read('apps/my-app/webpack.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { NxReactWebpackPlugin as P3 } from '@nx/react/webpack-plugin';
      import { NxReactWebpackPlugin } from '@nx/react/webpack-plugin';
      const { NxReactWebpackPlugin: P2 } = require('@nx/react/webpack-plugin');
      import { withReact } from '@nx/react';
      "
    `);
  });

  it('consumes whitespace before the trailing comma in ES imports', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/webpack.config.ts',
      `import { NxReactWebpackPlugin , withReact } from '@nx/react';`
    );

    await removeNxReactWebpackPluginImport(tree);

    expect(tree.read('apps/my-app/webpack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { NxReactWebpackPlugin } from '@nx/react/webpack-plugin';
      import { withReact } from '@nx/react';
      "
    `);
  });

  it('consumes whitespace before the trailing comma in CJS requires', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/webpack.config.js',
      `const { NxReactWebpackPlugin , withReact } = require('@nx/react');`
    );

    await removeNxReactWebpackPluginImport(tree);

    expect(tree.read('apps/my-app/webpack.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
      const { withReact } = require('@nx/react');
      "
    `);
  });

  it('does not modify files already using the correct sub-path import', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const original = `const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
module.exports = { plugins: [new NxReactWebpackPlugin()] };
`;
    tree.write('apps/my-app/webpack.config.js', original);

    await removeNxReactWebpackPluginImport(tree);

    expect(tree.read('apps/my-app/webpack.config.js', 'utf-8')).toEqual(
      original
    );
  });
});
