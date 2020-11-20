import * as ngSchematics from '@angular-devkit/schematics';
import { readWorkspace } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';

describe('NxPlugin plugin', () => {
  let appTree: ngSchematics.Tree;
  beforeEach(() => {
    appTree = createEmptyWorkspace(ngSchematics.Tree.empty());
  });

  it('should update the workspace.json file', async () => {
    const tree = await runSchematic(
      'plugin',
      { name: 'myPlugin', importPath: '@proj/my-plugin' },
      appTree
    );
    const workspace = await readWorkspace(tree);
    const project = workspace.projects['my-plugin'];
    expect(project.root).toEqual('libs/my-plugin');
    expect(project.architect.build).toEqual({
      builder: '@nrwl/node:package',
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
            glob: '**/*.!(ts)',
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
    expect(project.architect.lint).toEqual({
      builder: '@nrwl/linter:eslint',
      options: {
        lintFilePatterns: ['libs/my-plugin/**/*.ts'],
      },
    });
    expect(project.architect.test).toEqual({
      builder: '@nrwl/jest:jest',
      outputs: ['coverage/libs/my-plugin'],
      options: {
        jestConfig: 'libs/my-plugin/jest.config.js',
        passWithNoTests: true,
      },
    });
  });

  it('should place the plugin in a directory', async () => {
    const tree = await runSchematic(
      'plugin',
      {
        name: 'myPlugin',
        directory: 'plugins',
        importPath: '@project/plugins-my-plugin',
      },
      appTree
    );
    const workspace = await readWorkspace(tree);
    const project = workspace.projects['plugins-my-plugin'];
    const projectE2e = workspace.projects['plugins-my-plugin-e2e'];
    expect(project.root).toEqual('libs/plugins/my-plugin');
    expect(projectE2e.root).toEqual('apps/plugins/my-plugin-e2e');
  });

  it('should create schematic and builder files', async () => {
    const tree = await runSchematic(
      'plugin',
      { name: 'myPlugin', importPath: '@proj/my-plugin' },
      appTree
    );
    expect(tree.exists('libs/my-plugin/generators.json')).toBeTruthy();
    expect(tree.exists('libs/my-plugin/executors.json')).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/generators/my-plugin/schema.d.ts')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/generators/my-plugin/generator.ts')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/generators/my-plugin/generator.spec.ts')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/generators/my-plugin/schema.json')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/generators/my-plugin/schema.d.ts')
    ).toBeTruthy();
    expect(
      tree.exists(
        'libs/my-plugin/src/generators/my-plugin/files/src/index.ts__template__'
      )
    ).toBeTruthy();
    expect(
      tree.readContent(
        'libs/my-plugin/src/generators/my-plugin/files/src/index.ts__template__'
      )
    ).toContain('const variable = "<%= projectName %>";');
    expect(
      tree.exists('libs/my-plugin/src/executors/build/executor.ts')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/executors/build/executor.spec.ts')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/executors/build/schema.json')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/executors/build/schema.d.ts')
    ).toBeTruthy();
  });

  describe('--unitTestRunner', () => {
    describe('none', () => {
      it('should not generate test files', async () => {
        const tree = await runSchematic(
          'plugin',
          {
            name: 'myPlugin',
            importPath: '@proj/my-plugin',
            unitTestRunner: 'none',
          },
          appTree
        );

        expect(
          tree.exists('libs/my-plugin/src/generators/my-plugin/generator.ts')
        ).toBeTruthy();
        expect(
          tree.exists(
            'libs/my-plugin/src/generators/my-plugin/generator.spec.ts'
          )
        ).toBeFalsy();

        expect(
          tree.exists('libs/my-plugin/src/executors/build/executor.ts')
        ).toBeTruthy();
        expect(
          tree.exists('libs/my-plugin/src/executors/build/executor.spec.ts')
        ).toBeFalsy();
      });
    });
  });
});
