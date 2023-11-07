import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addProjectConfiguration, Tree, writeJson } from '@nx/devkit';

import { generatorGenerator } from './generator';
import { setCwd } from '@nx/devkit/internal-testing-utils';

describe('create-nodes-plugin/generator generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'eslint', {
      root: 'packages/eslint',
      targets: {
        build: {},
      },
    });

    jest.spyOn(process, 'cwd').mockReturnValue('/virtual/packages/eslint');

    setCwd('packages/eslint');
  });

  it('should run successfully', async () => {
    writeJson(tree, 'packages/eslint/package.json', {});
    await generatorGenerator(tree);
    expect(
      tree.read('packages/eslint/src/plugins/plugin.ts').toString()
    ).toMatchSnapshot();
    expect(
      tree.read('packages/eslint/src/plugins/plugin.spec.ts').toString()
    ).toMatchSnapshot();
    expect(
      tree
        .read(
          'packages/eslint/src/migrations/update-17-2-0/add-eslint-plugin.ts'
        )
        .toString()
    ).toMatchSnapshot();
  });

  it('should add the plugin path to package.json exports', async () => {
    writeJson(tree, 'packages/eslint/package.json', {
      name: '@nx/eslint',
      version: '0.0.1',
      private: false,
      description: 'Some description',
      repository: {
        type: 'git',
        url: 'https://github.com/nrwl/nx.git',
        directory: 'packages/eslint',
      },
      keywords: ['Monorepo', 'eslint', 'Web', 'CLI'],
      main: './index',
      typings: './index.d.ts',
      author: 'Victor Savkin',
      license: 'MIT',
      bugs: {
        url: 'https://github.com/nrwl/nx/issues',
      },
      homepage: 'https://nx.dev',
      generators: './generators.json',
      executors: './executors.json',
      'ng-update': {
        requirements: {},
        migrations: './migrations.json',
      },
      dependencies: {
        '@nx/devkit': 'file:../devkit',
      },
      peerDependencies: {},
      publishConfig: {
        access: 'public',
      },
      exports: {
        '.': './index.js',
        './package.json': './package.json',
        './migrations.json': './migrations.json',
        './generators.json': './generators.json',
        './executors.json': './executors.json',
        './executors': './executors.js',
        './src/executors/*/schema.json': './src/executors/*/schema.json',
        './src/executors/*.impl': './src/executors/*.impl.js',
        './src/executors/*/compat': './src/executors/*/compat.js',
      },
    });
    await generatorGenerator(tree);
    expect(
      tree.read('packages/eslint/package.json', 'utf-8')
    ).toMatchSnapshot();
  });
});
