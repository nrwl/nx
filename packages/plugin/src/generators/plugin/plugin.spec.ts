import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  getProjects,
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import { PackageJson } from 'nx/src/utils/package-json';
import { pluginGenerator } from './plugin';
import { Schema } from './schema';

const getSchema: (overrides?: Partial<Schema>) => Schema = (
  overrides = {}
) => ({
  directory: 'my-plugin',
  compiler: 'tsc',
  skipTsConfig: false,
  skipFormat: false,
  skipLintChecks: false,
  linter: Linter.EsLint,
  unitTestRunner: 'jest',
  ...overrides,
});

describe('NxPlugin Plugin Generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should update the project configuration', async () => {
    await pluginGenerator(tree, getSchema());
    const project = readProjectConfiguration(tree, 'my-plugin');
    expect(project.root).toEqual('my-plugin');
    expect(project.targets.build).toEqual({
      executor: '@nx/js:tsc',
      outputs: ['{options.outputPath}'],
      options: {
        outputPath: 'dist/my-plugin',
        tsConfig: 'my-plugin/tsconfig.lib.json',
        main: 'my-plugin/src/index.ts',
        assets: [
          'my-plugin/*.md',
          {
            input: './my-plugin/src',
            glob: '**/!(*.ts)',
            output: './src',
          },
          {
            input: './my-plugin/src',
            glob: '**/*.d.ts',
            output: './src',
          },
          {
            input: './my-plugin',
            glob: 'generators.json',
            output: '.',
          },
          {
            input: './my-plugin',
            glob: 'executors.json',
            output: '.',
          },
        ],
      },
    });
  });

  it('should place the plugin in a directory', async () => {
    await pluginGenerator(
      tree,
      getSchema({
        name: 'my-plugin',
        directory: 'plugins/my-plugin',
      })
    );
    const project = readProjectConfiguration(tree, 'my-plugin');
    const projectE2e = readProjectConfiguration(tree, 'my-plugin-e2e');
    expect(project.root).toEqual('plugins/my-plugin');
    expect(projectE2e.root).toEqual('plugins/my-plugin-e2e');
  });

  describe('asset paths', () => {
    it('should generate normalized asset paths for plugin in monorepo', async () => {
      await pluginGenerator(
        tree,
        getSchema({
          directory: 'my-plugin',
        })
      );
      const project = readProjectConfiguration(tree, 'my-plugin');
      const assets = project.targets.build.options.assets;
      expect(assets).toEqual([
        'my-plugin/*.md',
        {
          input: './my-plugin/src',
          glob: '**/!(*.ts)',
          output: './src',
        },
        {
          input: './my-plugin/src',
          glob: '**/*.d.ts',
          output: './src',
        },
        {
          input: './my-plugin',
          glob: 'generators.json',
          output: '.',
        },
        {
          input: './my-plugin',
          glob: 'executors.json',
          output: '.',
        },
      ]);
    });

    it('should generate normalized asset paths for plugin in standalone workspace', async () => {
      await pluginGenerator(
        tree,
        getSchema({
          name: 'my-plugin',
          directory: '.',
        })
      );
      const project = readProjectConfiguration(tree, 'my-plugin');
      const assets = project.targets.build.options.assets;
      expect(assets).toEqual([
        '*.md',
        {
          input: './src',
          glob: '**/!(*.ts)',
          output: './src',
        },
        {
          input: './src',
          glob: '**/*.d.ts',
          output: './src',
        },
        {
          input: '.',
          glob: 'generators.json',
          output: '.',
        },
        {
          input: '.',
          glob: 'executors.json',
          output: '.',
        },
      ]);
    });
  });

  describe('--unitTestRunner', () => {
    describe('none', () => {
      it('should not generate test files', async () => {
        await pluginGenerator(
          tree,
          getSchema({
            directory: 'my-plugin',
            unitTestRunner: 'none',
          })
        );

        ['my-plugin/jest.config.ts'].forEach((path) =>
          expect(tree.exists(path)).toBeFalsy()
        );

        expect(
          readProjectConfiguration(tree, 'my-plugin').targets.test
        ).not.toBeDefined();
      });
    });
  });

  describe('--compiler', () => {
    it('should specify tsc as compiler', async () => {
      await pluginGenerator(
        tree,
        getSchema({
          compiler: 'tsc',
        })
      );

      const { build } = readProjectConfiguration(tree, 'my-plugin').targets;

      expect(build.executor).toEqual('@nx/js:tsc');
    });

    it('should specify swc as compiler', async () => {
      await pluginGenerator(
        tree,
        getSchema({
          compiler: 'swc',
        })
      );

      const { build } = readProjectConfiguration(tree, 'my-plugin').targets;

      expect(build.executor).toEqual('@nx/js:swc');
    });
  });

  describe('--importPath', () => {
    it('should use the workspace npmScope by default for the package.json', async () => {
      await pluginGenerator(tree, getSchema());

      const { root } = readProjectConfiguration(tree, 'my-plugin');
      const { name } = readJson<PackageJson>(
        tree,
        joinPathFragments(root, 'package.json')
      );

      expect(name).toEqual('@proj/my-plugin');
    });

    it('should correctly setup npmScope less workspaces', async () => {
      updateJson(tree, 'package.json', (j) => {
        j.name = 'source';
        return j;
      });

      await pluginGenerator(tree, getSchema());

      const { root } = readProjectConfiguration(tree, 'my-plugin');
      const { name } = readJson<PackageJson>(
        tree,
        joinPathFragments(root, 'package.json')
      );

      expect(name).toEqual('my-plugin');
    });

    it('should use importPath as the package.json name', async () => {
      await pluginGenerator(
        tree,
        getSchema({ importPath: '@my-company/my-plugin' })
      );

      const { root } = readProjectConfiguration(tree, 'my-plugin');
      const { name } = readJson<PackageJson>(
        tree,
        joinPathFragments(root, 'package.json')
      );

      expect(name).toEqual('@my-company/my-plugin');
    });
  });

  describe('--e2eTestRunner', () => {
    it('should allow the e2e project to be skipped', async () => {
      await pluginGenerator(tree, getSchema({ e2eTestRunner: 'none' }));
      const projects = getProjects(tree);
      expect(projects.has('my-plugin-e2e')).toBe(false);
    });
  });
});
