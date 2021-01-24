import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';
import { Linter, readJsonInTree } from '@nrwl/workspace';

describe('karmaProject', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
    appTree = await runSchematic(
      'lib',
      {
        name: 'lib1',
        unitTestRunner: 'none',
      },
      appTree
    );
    appTree = await runSchematic(
      'app',
      {
        name: 'app1',
        unitTestRunner: 'none',
      },
      appTree
    );
  });

  it('should generate files', async () => {
    const resultTree = await runSchematic(
      'karma-project',
      {
        project: 'lib1',
      },
      appTree
    );
    expect(resultTree.exists('/libs/lib1/karma.conf.js')).toBeTruthy();
    expect(resultTree.exists('/libs/lib1/tsconfig.spec.json')).toBeTruthy();
  });

  it('should create a karma.conf.js', async () => {
    const resultTree = await runSchematic(
      'karma-project',
      {
        project: 'lib1',
      },
      appTree
    );
    expect(resultTree.readContent('libs/lib1/karma.conf.js'))
      .toBe(`// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

const { join } = require('path');
const getBaseKarmaConfig = require('../../karma.conf');

module.exports = function(config) {
  const baseConfig = getBaseKarmaConfig();
  config.set({
    ...baseConfig,
    coverageIstanbulReporter: {
      ...baseConfig.coverageIstanbulReporter,
      dir: join(__dirname, '../../coverage/libs/lib1')
    }
  });
};
`);
  });

  it('should update the local tsconfig.json', async () => {
    const resultTree = await runSchematic(
      'karma-project',
      {
        project: 'lib1',
      },
      appTree
    );
    const tsConfig = readJsonInTree(resultTree, 'libs/lib1/tsconfig.json');
    expect(tsConfig.references).toContainEqual({
      path: './tsconfig.spec.json',
    });
  });

  describe('library', () => {
    it('should alter workspace.json', async () => {
      const resultTree = await runSchematic(
        'karma-project',
        {
          project: 'lib1',
        },
        appTree
      );
      const workspaceJson = readJsonInTree(resultTree, 'workspace.json');
      expect(workspaceJson.projects.lib1.architect.test).toEqual({
        builder: '@angular-devkit/build-angular:karma',
        options: {
          main: 'libs/lib1/src/test.ts',
          tsConfig: 'libs/lib1/tsconfig.spec.json',
          karmaConfig: 'libs/lib1/karma.conf.js',
        },
      });
    });

    it('should create a tsconfig.spec.json', async () => {
      const resultTree = await runSchematic(
        'karma-project',
        {
          project: 'lib1',
        },
        appTree
      );
      const tsConfig = readJsonInTree(
        resultTree,
        'libs/lib1/tsconfig.spec.json'
      );
      expect(tsConfig).toEqual({
        extends: './tsconfig.json',
        compilerOptions: {
          outDir: '../../dist/out-tsc',
          types: ['jasmine', 'node'],
        },
        files: ['src/test.ts'],
        include: ['**/*.spec.ts', '**/*.d.ts'],
      });
    });

    it('should create test.ts', async () => {
      const resultTree = await runSchematic(
        'karma-project',
        {
          project: 'lib1',
        },
        appTree
      );
      const testTs = resultTree.read('libs/lib1/src/test.ts').toString();
      expect(testTs).toContain("import 'zone.js/dist/zone';");
    });
  });

  describe('applications', () => {
    it('should alter workspace.json', async () => {
      const resultTree = await runSchematic(
        'karma-project',
        {
          project: 'app1',
        },
        appTree
      );
      const workspaceJson = readJsonInTree(resultTree, 'workspace.json');
      expect(workspaceJson.projects.app1.architect.test).toEqual({
        builder: '@angular-devkit/build-angular:karma',
        options: {
          main: 'apps/app1/src/test.ts',
          polyfills: 'apps/app1/src/polyfills.ts',
          tsConfig: 'apps/app1/tsconfig.spec.json',
          karmaConfig: 'apps/app1/karma.conf.js',
          styles: [],
          scripts: [],
          assets: [],
        },
      });
    });

    it('should create a tsconfig.spec.json', async () => {
      const resultTree = await runSchematic(
        'karma-project',
        {
          project: 'app1',
        },
        appTree
      );
      const tsConfig = readJsonInTree(
        resultTree,
        'apps/app1/tsconfig.spec.json'
      );
      expect(tsConfig).toEqual({
        extends: './tsconfig.json',
        compilerOptions: {
          outDir: '../../dist/out-tsc',
          types: ['jasmine', 'node'],
        },
        files: ['src/test.ts', 'src/polyfills.ts'],
        include: ['**/*.spec.ts', '**/*.d.ts'],
      });
    });

    it('should create test.ts', async () => {
      const resultTree = await runSchematic(
        'karma-project',
        {
          project: 'app1',
        },
        appTree
      );
      const testTs = resultTree.read('apps/app1/src/test.ts').toString();
      expect(testTs).not.toContain("import 'zone.js/dist/zone';");
    });
  });

  describe('linter', () => {
    it('should work with tslint as linter', async () => {
      const resultTree = await runSchematic(
        'lib',
        {
          name: 'lib-with-tslint-and-karma',
          unitTestRunner: 'karma',
          linter: Linter.TsLint,
        },
        appTree
      );
      const workspaceJson = readJsonInTree(resultTree, 'workspace.json');

      expect(workspaceJson.projects['lib-with-tslint-and-karma'].architect.lint)
        .toMatchInlineSnapshot(`
        Object {
          "builder": "@angular-devkit/build-angular:tslint",
          "options": Object {
            "exclude": Array [
              "**/node_modules/**",
              "!libs/lib-with-tslint-and-karma/**/*",
            ],
            "tsConfig": Array [
              "libs/lib-with-tslint-and-karma/tsconfig.lib.json",
              "libs/lib-with-tslint-and-karma/tsconfig.spec.json",
            ],
          },
        }
      `);

      expect(
        workspaceJson.projects['lib-with-tslint-and-karma'].architect.test
      ).toEqual({
        builder: '@angular-devkit/build-angular:karma',
        options: {
          main: 'libs/lib-with-tslint-and-karma/src/test.ts',
          tsConfig: 'libs/lib-with-tslint-and-karma/tsconfig.spec.json',
          karmaConfig: 'libs/lib-with-tslint-and-karma/karma.conf.js',
        },
      });
    });
  });
});
