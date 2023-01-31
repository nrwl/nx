import type { Tree } from '@nrwl/devkit';
import { readJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import hostGenerator from './host';
import { Linter } from '@nrwl/linter';

describe('hostGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should generate host files and configs', async () => {
    await hostGenerator(tree, {
      name: 'test',
      style: 'css',
      linter: Linter.None,
      unitTestRunner: 'none',
      e2eTestRunner: 'none',
    });

    expect(tree.exists('apps/test/tsconfig.json'));
    expect(tree.exists('apps/test/webpack.config.prod.js'));
    expect(tree.exists('apps/test/webpack.config.js'));
    expect(tree.exists('apps/test/src/bootstrap.tsx'));
    expect(tree.exists('apps/test/src/main.ts'));
    expect(tree.exists('apps/test/src/remotes.d.ts'));
  });

  it('should install @nrwl/web for the file-server executor', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await hostGenerator(tree, {
      name: 'test',
      style: 'css',
      linter: Linter.None,
      unitTestRunner: 'none',
      e2eTestRunner: 'none',
    });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@nrwl/web']).toBeDefined();
  });

  it('should generate host files and configs for SSR', async () => {
    await hostGenerator(tree, {
      name: 'test',
      ssr: true,
      style: 'css',
      linter: Linter.None,
      unitTestRunner: 'none',
      e2eTestRunner: 'none',
    });

    expect(tree.exists('apps/test/tsconfig.json'));
    expect(tree.exists('apps/test/webpack.config.prod.js'));
    expect(tree.exists('apps/test/webpack.config.server.js'));
    expect(tree.exists('apps/test/webpack.config.js'));
    expect(tree.exists('apps/test/src/main.server.tsx'));
    expect(tree.exists('apps/test/src/bootstrap.tsx'));
    expect(tree.exists('apps/test/src/main.ts'));
    expect(tree.exists('apps/test/src/remotes.d.ts'));

    expect(readJson(tree, 'apps/test/tsconfig.server.json')).toEqual({
      compilerOptions: {
        outDir: '../../out-tsc/server',
        target: 'es2019',
        types: ['node'],
      },
      extends: './tsconfig.app.json',
      include: ['src/remotes.d.ts', 'src/main.server.tsx', 'server.ts'],
    });
  });
});
