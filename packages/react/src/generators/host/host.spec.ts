import type { Tree } from '@nx/devkit';
import { readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import hostGenerator from './host';
import { Linter } from '@nx/linter';

describe('hostGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should generate host files and configs', async () => {
    await hostGenerator(tree, {
      name: 'test',
      style: 'css',
      linter: Linter.None,
      unitTestRunner: 'none',
      e2eTestRunner: 'none',
      projectNameAndRootFormat: 'as-provided',
    });

    expect(tree.exists('test/tsconfig.json'));
    expect(tree.exists('test/webpack.config.prod.js'));
    expect(tree.exists('test/webpack.config.js'));
    expect(tree.exists('test/src/bootstrap.tsx'));
    expect(tree.exists('test/src/main.ts'));
    expect(tree.exists('test/src/remotes.d.ts'));
  });

  it('should install @nx/web for the file-server executor', async () => {
    const tree = createTreeWithEmptyWorkspace();
    await hostGenerator(tree, {
      name: 'test',
      style: 'css',
      linter: Linter.None,
      unitTestRunner: 'none',
      e2eTestRunner: 'none',
      projectNameAndRootFormat: 'as-provided',
    });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@nx/web']).toBeDefined();
  });

  it('should generate host files and configs for SSR', async () => {
    await hostGenerator(tree, {
      name: 'test',
      ssr: true,
      style: 'css',
      linter: Linter.None,
      unitTestRunner: 'none',
      e2eTestRunner: 'none',
      projectNameAndRootFormat: 'as-provided',
    });

    expect(tree.exists('test/tsconfig.json'));
    expect(tree.exists('test/webpack.config.prod.js'));
    expect(tree.exists('test/webpack.config.server.js'));
    expect(tree.exists('test/webpack.config.js'));
    expect(tree.exists('test/src/main.server.tsx'));
    expect(tree.exists('test/src/bootstrap.tsx'));
    expect(tree.exists('test/src/main.ts'));
    expect(tree.exists('test/src/remotes.d.ts'));

    expect(readJson(tree, 'test/tsconfig.server.json')).toEqual({
      compilerOptions: {
        outDir: '../../out-tsc/server',
        target: 'es2019',
        types: ['node'],
      },
      extends: './tsconfig.app.json',
      include: ['src/remotes.d.ts', 'src/main.server.tsx', 'server.ts'],
    });
  });

  it('should generate a host and remotes in a directory correctly when using --projectNameAndRootFormat=as-provided', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await hostGenerator(tree, {
      name: 'hostApp',
      directory: 'foo/hostApp',
      remotes: ['remote1', 'remote2', 'remote3'],
      projectNameAndRootFormat: 'as-provided',
      e2eTestRunner: 'none',
      linter: Linter.None,
      style: 'css',
      unitTestRunner: 'none',
    });

    expect(tree.exists('foo/remote1/project.json')).toBeTruthy();
    expect(tree.exists('foo/remote2/project.json')).toBeTruthy();
    expect(tree.exists('foo/remote3/project.json')).toBeTruthy();
    expect(
      tree.read('foo/host-app/module-federation.config.js', 'utf-8')
    ).toContain(`'remote1', 'remote2', 'remote3'`);
  });
});
