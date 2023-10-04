import {
  getProjects,
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
import { PackageJson } from 'nx/src/utils/package-json';
import { pluginGenerator } from './plugin';
import { Schema } from './schema';

const getSchema: (overrides?: Partial<Schema>) => Schema = (
  overrides = {}
) => ({
  name: 'my-plugin',
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
    expect(project.root).toEqual('libs/my-plugin');
    expect(project.targets.build).toEqual({
      executor: '@nx/js:tsc',
      outputs: ['{options.outputPath}'],
      options: {
        outputPath: 'dist/libs/my-plugin',
        tsConfig: 'libs/my-plugin/tsconfig.lib.json',
        main: 'libs/my-plugin/src/index.ts',
        assets: [
          'libs/my-plugin/*.md',
          {
            input: './libs/my-plugin/src',
            glob: '**/!(*.ts)',
            output: './src',
          },
          {
            input: './libs/my-plugin/src',
            glob: '**/*.d.ts',
            output: './src',
          },
          {
            input: './libs/my-plugin',
            glob: 'generators.json',
            output: '.',
          },
          {
            input: './libs/my-plugin',
            glob: 'executors.json',
            output: '.',
          },
        ],
      },
    });
    expect(project.targets.lint).toEqual({
      executor: '@nx/linter:eslint',
      outputs: ['{options.outputFile}'],
      options: {
        lintFilePatterns: expect.arrayContaining([
          'libs/my-plugin/**/*.ts',
          'libs/my-plugin/package.json',
        ]),
      },
    });
    expect(project.targets.test).toEqual({
      executor: '@nx/jest:jest',
      outputs: ['{workspaceRoot}/coverage/{projectRoot}'],
      options: {
        jestConfig: 'libs/my-plugin/jest.config.ts',
        passWithNoTests: true,
      },
      configurations: {
        ci: {
          ci: true,
          codeCoverage: true,
        },
      },
    });
  });

  it('should place the plugin in a directory', async () => {
    await pluginGenerator(
      tree,
      getSchema({
        name: 'myPlugin',
        directory: 'plugins',
      })
    );
    const project = readProjectConfiguration(tree, 'plugins-my-plugin');
    const projectE2e = readProjectConfiguration(tree, 'plugins-my-plugin-e2e');
    expect(project.root).toEqual('libs/plugins/my-plugin');
    expect(projectE2e.root).toEqual('apps/plugins/my-plugin-e2e');
  });

  describe('asset paths', () => {
    it('should generate normalized asset paths for plugin in monorepo', async () => {
      await pluginGenerator(
        tree,
        getSchema({
          name: 'myPlugin',
        })
      );
      const project = readProjectConfiguration(tree, 'my-plugin');
      const assets = project.targets.build.options.assets;
      expect(assets).toEqual([
        'libs/my-plugin/*.md',
        {
          input: './libs/my-plugin/src',
          glob: '**/!(*.ts)',
          output: './src',
        },
        {
          input: './libs/my-plugin/src',
          glob: '**/*.d.ts',
          output: './src',
        },
        {
          input: './libs/my-plugin',
          glob: 'generators.json',
          output: '.',
        },
        {
          input: './libs/my-plugin',
          glob: 'executors.json',
          output: '.',
        },
      ]);
    });

    it('should generate normalized asset paths for plugin in standalone workspace', async () => {
      await pluginGenerator(
        tree,
        getSchema({
          name: 'myPlugin',
          rootProject: true,
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
            name: 'myPlugin',
            unitTestRunner: 'none',
          })
        );

        ['libs/my-plugin/jest.config.ts'].forEach((path) =>
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
      // remove the npmScope from nx.json
      const nxJson = JSON.parse(tree.read('nx.json')!.toString());
      delete nxJson.npmScope;
      tree.write('nx.json', JSON.stringify(nxJson));

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
      expect(projects.has('plugins-my-plugin-e2e')).toBe(false);
    });
  });
});
