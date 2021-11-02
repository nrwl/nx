import { pluginGenerator } from './plugin';
import { Tree, readProjectConfiguration } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

describe('NxPlugin Plugin Generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update the workspace.json file', async () => {
    await pluginGenerator(tree, { name: 'myPlugin' } as any);
    const project = readProjectConfiguration(tree, 'my-plugin');
    expect(project.root).toEqual('libs/my-plugin');
    expect(project.targets.build).toEqual({
      executor: '@nrwl/node:package',
      outputs: ['{options.outputPath}'],
      options: {
        outputPath: 'dist/libs/my-plugin',
        tsConfig: 'libs/my-plugin/tsconfig.lib.json',
        packageJson: 'libs/my-plugin/package.json',
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
      executor: '@nrwl/linter:eslint',
      outputs: ['{options.outputFile}'],
      options: {
        lintFilePatterns: ['libs/my-plugin/**/*.ts'],
      },
    });
    expect(project.targets.test).toEqual({
      executor: '@nrwl/jest:jest',
      outputs: ['coverage/libs/my-plugin'],
      options: {
        jestConfig: 'libs/my-plugin/jest.config.js',
        passWithNoTests: true,
      },
    });
  });

  it('should place the plugin in a directory', async () => {
    await pluginGenerator(tree, {
      name: 'myPlugin',
      directory: 'plugins',
    } as any);
    const project = readProjectConfiguration(tree, 'plugins-my-plugin');
    const projectE2e = readProjectConfiguration(tree, 'plugins-my-plugin-e2e');
    expect(project.root).toEqual('libs/plugins/my-plugin');
    expect(projectE2e.root).toEqual('apps/plugins/my-plugin-e2e');
  });

  it('should create schematic and builder files', async () => {
    await pluginGenerator(tree, { name: 'myPlugin' } as any);

    [
      'libs/my-plugin/generators.json',
      'libs/my-plugin/executors.json',
      'libs/my-plugin/src/generators/my-plugin/schema.d.ts',
      'libs/my-plugin/src/generators/my-plugin/generator.ts',
      'libs/my-plugin/src/generators/my-plugin/generator.spec.ts',
      'libs/my-plugin/src/generators/my-plugin/schema.json',
      'libs/my-plugin/src/generators/my-plugin/schema.d.ts',
      'libs/my-plugin/src/generators/my-plugin/files/src/index.ts__template__',
      'libs/my-plugin/src/executors/build/executor.ts',
      'libs/my-plugin/src/executors/build/executor.spec.ts',
      'libs/my-plugin/src/executors/build/schema.json',
      'libs/my-plugin/src/executors/build/schema.d.ts',
    ].forEach((path) => expect(tree.exists(path)).toBeTruthy());

    expect(
      tree.read(
        'libs/my-plugin/src/generators/my-plugin/files/src/index.ts__template__',
        'utf-8'
      )
    ).toContain('const variable = "<%= projectName %>";');
  });

  describe('--unitTestRunner', () => {
    describe('none', () => {
      it('should not generate test files', async () => {
        await pluginGenerator(tree, {
          name: 'myPlugin',
          unitTestRunner: 'none',
        } as any);

        [
          'libs/my-plugin/src/generators/my-plugin/generator.ts',
          'libs/my-plugin/src/executors/build/executor.ts',
        ].forEach((path) => expect(tree.exists(path)).toBeTruthy());

        [
          'libs/my-plugin/src/generators/my-plugin/generator.spec.ts',
          'libs/my-plugin/src/executors/build/executor.spec.ts',
        ].forEach((path) => expect(tree.exists(path)).toBeFalsy());
      });
    });
  });
});
