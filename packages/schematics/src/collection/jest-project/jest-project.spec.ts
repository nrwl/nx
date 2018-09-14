import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Tree, VirtualTree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '../../utils/testing-utils';
import { readJsonInTree } from '@nrwl/schematics/src/utils/ast-utils';

describe('lib', () => {
  const schematicRunner = new SchematicTestRunner(
    '@nrwl/schematics',
    path.join(__dirname, '../../collection.json')
  );

  let appTree: Tree;

  beforeEach(() => {
    appTree = new VirtualTree();
    appTree = createEmptyWorkspace(appTree);
    appTree = schematicRunner.runSchematic('jest', {}, appTree);
    appTree = schematicRunner.runSchematic(
      'lib',
      {
        name: 'lib1',
        unitTestRunner: 'none'
      },
      appTree
    );
  });

  it('should generate files', () => {
    const resultTree = schematicRunner.runSchematic(
      'jest-project',
      {
        project: 'lib1'
      },
      appTree
    );
    expect(resultTree.exists('/libs/lib1/src/test-setup.ts')).toBeTruthy();
    expect(resultTree.exists('/libs/lib1/jest.config.js')).toBeTruthy();
    expect(resultTree.exists('/libs/lib1/tsconfig.spec.json')).toBeTruthy();
  });

  it('should alter angular.json', () => {
    const resultTree = schematicRunner.runSchematic(
      'jest-project',
      {
        project: 'lib1'
      },
      appTree
    );
    const angularJson = readJsonInTree(resultTree, 'angular.json');
    expect(angularJson.projects.lib1.architect.test).toEqual({
      builder: '@nrwl/builders:jest',
      options: {
        jestConfig: 'libs/lib1/jest.config.js',
        setupFile: 'libs/lib1/src/test-setup.ts',
        tsConfig: 'libs/lib1/tsconfig.spec.json'
      }
    });
    expect(angularJson.projects.lib1.architect.lint.options.tsConfig).toContain(
      'libs/lib1/tsconfig.spec.json'
    );
  });

  it('should create a jest.config.js', () => {
    const resultTree = schematicRunner.runSchematic(
      'jest-project',
      {
        project: 'lib1'
      },
      appTree
    );
    expect(resultTree.readContent('libs/lib1/jest.config.js'))
      .toBe(`module.exports = {
  name: 'lib1',
  preset: '../../jest.config.js',
  coverageDirectory: '../../coverage/libs/lib1'
};
`);
  });

  it('should create a tsconfig.spec.json', () => {
    const resultTree = schematicRunner.runSchematic(
      'jest-project',
      {
        project: 'lib1'
      },
      appTree
    );
    const tsConfig = readJsonInTree(resultTree, 'libs/lib1/tsconfig.spec.json');
    expect(tsConfig).toEqual({
      extends: '../../tsconfig.json',
      compilerOptions: {
        module: 'commonjs',
        outDir: '../../dist/out-tsc/libs/lib1',
        types: ['jest', 'node']
      },
      files: ['src/test-setup.ts', 'src/polyfills.ts'],
      include: ['**/*.spec.ts', '**/*.d.ts']
    });
  });

  describe('--skip-setup-file', () => {
    it('should generate src/test-setup.ts', () => {
      const resultTree = schematicRunner.runSchematic(
        'jest-project',
        {
          project: 'lib1',
          skipSetupFile: true
        },
        appTree
      );
      expect(resultTree.exists('src/test-setup.ts')).toBeFalsy();
    });

    it('should not list the setup file in angular.json', () => {
      const resultTree = schematicRunner.runSchematic(
        'jest-project',
        {
          project: 'lib1',
          skipSetupFile: true
        },
        appTree
      );
      const angularJson = readJsonInTree(resultTree, 'angular.json');
      expect(
        angularJson.projects.lib1.architect.test.options.setupFile
      ).toBeUndefined();
    });

    it('should not list the setup file in tsconfig.spec.json', () => {
      const resultTree = schematicRunner.runSchematic(
        'jest-project',
        {
          project: 'lib1',
          skipSetupFile: true
        },
        appTree
      );
      const tsConfig = readJsonInTree(
        resultTree,
        'libs/lib1/tsconfig.spec.json'
      );
      expect(tsConfig.files).not.toContain('src/test-setup.ts');
    });
  });
});
