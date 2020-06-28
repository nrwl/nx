import * as ngSchematics from '@angular-devkit/schematics';
import { readJsonInTree, readWorkspace } from '@nrwl/workspace';
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
            glob: 'collection.json',
            output: '.',
          },
          {
            input: './libs/my-plugin',
            glob: 'builders.json',
            output: '.',
          },
        ],
      },
    });
    expect(project.architect.lint).toEqual({
      builder: '@angular-devkit/build-angular:tslint',
      options: {
        exclude: ['**/node_modules/**', '!libs/my-plugin/**/*'],
        tsConfig: [
          'libs/my-plugin/tsconfig.lib.json',
          'libs/my-plugin/tsconfig.spec.json',
        ],
      },
    });
    expect(project.architect.test).toEqual({
      builder: '@nrwl/jest:jest',
      options: {
        jestConfig: 'libs/my-plugin/jest.config.js',
        tsConfig: 'libs/my-plugin/tsconfig.spec.json',
        passWithNoTests: true,
      },
    });
  });

  it('should update the tsconfig.lib.json file', async () => {
    const tree = await runSchematic(
      'plugin',
      { name: 'myPlugin', importPath: '@proj/my-plugin' },
      appTree
    );
    const tsLibConfig = readJsonInTree(
      tree,
      'libs/my-plugin/tsconfig.lib.json'
    );
    expect(tsLibConfig.compilerOptions.rootDir).toEqual('.');
  });

  it('should create schematic and builder files', async () => {
    const tree = await runSchematic(
      'plugin',
      { name: 'myPlugin', importPath: '@proj/my-plugin' },
      appTree
    );
    expect(tree.exists('libs/my-plugin/collection.json')).toBeTruthy();
    expect(tree.exists('libs/my-plugin/builders.json')).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/schematics/my-plugin/schema.d.ts')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/schematics/my-plugin/schematic.ts')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/schematics/my-plugin/schematic.spec.ts')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/schematics/my-plugin/schema.json')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/schematics/my-plugin/schema.d.ts')
    ).toBeTruthy();
    expect(
      tree.exists(
        'libs/my-plugin/src/schematics/my-plugin/files/src/index.ts.template'
      )
    ).toBeTruthy();
    expect(
      tree.readContent(
        'libs/my-plugin/src/schematics/my-plugin/files/src/index.ts.template'
      )
    ).toContain('const variable = "<%= projectName %>";');
    expect(
      tree.exists('libs/my-plugin/src/builders/build/builder.ts')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/builders/build/builder.spec.ts')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/builders/build/schema.json')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/builders/build/schema.d.ts')
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
          tree.exists('libs/my-plugin/src/schematics/my-plugin/schematic.ts')
        ).toBeTruthy();
        expect(
          tree.exists(
            'libs/my-plugin/src/schematics/my-plugin/schematic.spec.ts'
          )
        ).toBeFalsy();

        expect(
          tree.exists('libs/my-plugin/src/builders/build/builder.ts')
        ).toBeTruthy();
        expect(
          tree.exists('libs/my-plugin/src/builders/build/builder.spec.ts')
        ).toBeFalsy();
      });
    });
  });
});
