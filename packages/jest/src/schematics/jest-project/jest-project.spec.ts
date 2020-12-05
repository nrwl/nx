import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree, updateJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runSchematic } from '../../utils/testing';
import { tags } from '@angular-devkit/core';
import { JestProjectSchema } from './schema.d';
import { jestConfigObject } from '../../utils/config/functions';

describe('jestProject', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
    appTree = await callRule(
      updateJsonInTree('workspace.json', (json) => {
        json.projects.lib1 = {
          root: 'libs/lib1',
          architect: {
            lint: {
              builder: '@angular-devkit/build-angular:tslint',
              options: {
                tsConfig: [],
              },
            },
          },
        };
        return json;
      }),
      appTree
    );
    appTree = await callRule(
      updateJsonInTree('libs/lib1/tsconfig.json', () => {
        return {
          files: [],
          include: [],
          references: [],
        };
      }),
      appTree
    );
  });

  it('should generate files', async () => {
    const resultTree = await runSchematic(
      'jest-project',
      {
        project: 'lib1',
        setupFile: 'angular',
      },
      appTree
    );
    expect(resultTree.exists('/libs/lib1/src/test-setup.ts')).toBeTruthy();
    expect(resultTree.exists('/libs/lib1/jest.config.js')).toBeTruthy();
    expect(resultTree.exists('/libs/lib1/tsconfig.spec.json')).toBeTruthy();
  });

  it('should alter workspace.json', async () => {
    const resultTree = await runSchematic(
      'jest-project',
      {
        project: 'lib1',
        setupFile: 'angular',
      },
      appTree
    );
    const workspaceJson = readJsonInTree(resultTree, 'workspace.json');
    expect(workspaceJson.projects.lib1.architect.test).toEqual({
      builder: '@nrwl/jest:jest',
      outputs: ['coverage/libs/lib1'],
      options: {
        jestConfig: 'libs/lib1/jest.config.js',
        passWithNoTests: true,
      },
    });
    expect(
      workspaceJson.projects.lib1.architect.lint.options.tsConfig
    ).toContain('libs/lib1/tsconfig.spec.json');
  });

  it('should create a jest.config.js', async () => {
    const resultTree = await runSchematic<JestProjectSchema>(
      'jest-project',
      {
        project: 'lib1',
      },
      appTree
    );
    expect(
      tags.stripIndents`${resultTree.readContent('libs/lib1/jest.config.js')}`
    ).toBe(tags.stripIndents`module.exports = {
      displayName: 'lib1',
      preset: '../../jest.preset.js',
      globals: {
        'ts-jest': {
          tsConfig: '<rootDir>/tsconfig.spec.json',
        }
      },
      coverageDirectory: '../../coverage/libs/lib1',
      snapshotSerializers: [
        'jest-preset-angular/build/AngularNoNgAttributesSnapshotSerializer.js',
        'jest-preset-angular/build/AngularSnapshotSerializer.js',
        'jest-preset-angular/build/HTMLCommentSerializer.js'
      ]
     };`);
  });

  it('should add a project reference in the root jest.config.js', async () => {
    const resultTree = await runSchematic(
      'jest-project',
      {
        project: 'lib1',
      },
      appTree
    );
    const jestConfig = jestConfigObject(resultTree, 'jest.config.js');

    expect(jestConfig.projects).toEqual(['<rootDir>/libs/lib1']);
  });

  it('should add a reference to solution tsconfig.json', async () => {
    const resultTree = await runSchematic(
      'jest-project',
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

  it('should create a tsconfig.spec.json', async () => {
    const resultTree = await runSchematic(
      'jest-project',
      {
        project: 'lib1',
        setupFile: 'angular',
      },
      appTree
    );
    const tsConfig = readJsonInTree(resultTree, 'libs/lib1/tsconfig.spec.json');
    expect(tsConfig).toEqual({
      extends: './tsconfig.json',
      compilerOptions: {
        module: 'commonjs',
        outDir: '../../dist/out-tsc',
        types: ['jest', 'node'],
      },
      files: ['src/test-setup.ts'],
      include: ['**/*.spec.ts', '**/*.d.ts'],
    });
  });

  describe('--setup-file', () => {
    it('should generate src/test-setup.ts', async () => {
      const resultTree = await runSchematic(
        'jest-project',
        {
          project: 'lib1',
          setupFile: 'none',
        },
        appTree
      );
      expect(resultTree.exists('src/test-setup.ts')).toBeFalsy();
      expect(resultTree.readContent('libs/lib1/jest.config.js')).not.toContain(
        `setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],`
      );
    });

    it('should have setupFilesAfterEnv in the jest.config when generated for web-components', async () => {
      const resultTree = await runSchematic(
        'jest-project',
        {
          project: 'lib1',
          setupFile: 'web-components',
        },
        appTree
      );
      expect(resultTree.readContent('libs/lib1/jest.config.js')).toContain(
        `setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],`
      );
    });

    it('should have setupFilesAfterEnv and globals.ts-jest in the jest.config when generated for angular', async () => {
      const resultTree = await runSchematic(
        'jest-project',
        {
          project: 'lib1',
          setupFile: 'angular',
        },
        appTree
      );

      const jestConfig = resultTree.readContent('libs/lib1/jest.config.js');
      expect(jestConfig).toContain(
        `setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],`
      );
      expect(tags.stripIndents`${jestConfig}`)
        .toContain(tags.stripIndents`globals: {
    'ts-jest': {
      tsConfig: '<rootDir>/tsconfig.spec.json',
      stringifyContentPathRegex: '\\.(html|svg)$',
      astTransformers: {
        before: [
          'jest-preset-angular/build/InlineFilesTransformer',
          'jest-preset-angular/build/StripStylesTransformer'
        ]
      },`);
    });

    it('should not list the setup file in workspace.json', async () => {
      const resultTree = await runSchematic(
        'jest-project',
        {
          project: 'lib1',
          setupFile: 'none',
        },
        appTree
      );
      const workspaceJson = readJsonInTree(resultTree, 'workspace.json');
      expect(
        workspaceJson.projects.lib1.architect.test.options.setupFile
      ).toBeUndefined();
    });

    it('should not list the setup file in tsconfig.spec.json', async () => {
      const resultTree = await runSchematic(
        'jest-project',
        {
          project: 'lib1',
          setupFile: 'none',
        },
        appTree
      );
      const tsConfig = readJsonInTree(
        resultTree,
        'libs/lib1/tsconfig.spec.json'
      );
      expect(tsConfig.files).toBeUndefined();
    });
  });

  describe('--skip-setup-file', () => {
    it('should generate src/test-setup.ts', async () => {
      const resultTree = await runSchematic(
        'jest-project',
        {
          project: 'lib1',
          skipSetupFile: true,
        },
        appTree
      );
      expect(resultTree.exists('src/test-setup.ts')).toBeFalsy();
    });

    it('should not list the setup file in workspace.json', async () => {
      const resultTree = await runSchematic(
        'jest-project',
        {
          project: 'lib1',
          skipSetupFile: true,
        },
        appTree
      );
      const workspaceJson = readJsonInTree(resultTree, 'workspace.json');
      expect(
        workspaceJson.projects.lib1.architect.test.options.setupFile
      ).toBeUndefined();
    });

    it('should not list the setup file in tsconfig.spec.json', async () => {
      const resultTree = await runSchematic(
        'jest-project',
        {
          project: 'lib1',
          skipSetupFile: true,
        },
        appTree
      );
      const tsConfig = readJsonInTree(
        resultTree,
        'libs/lib1/tsconfig.spec.json'
      );
      expect(tsConfig.files).toBeUndefined();
    });
  });

  describe('--skip-serializers', () => {
    it('should not list the serializers in jest.config.js', async () => {
      const resultTree = await runSchematic(
        'jest-project',
        {
          project: 'lib1',
          skipSerializers: true,
        },
        appTree
      );
      const jestConfig = resultTree.readContent('libs/lib1/jest.config.js');
      expect(jestConfig).not.toContain(`
  snapshotSerializers: [
    'jest-preset-angular/build/AngularNoNgAttributesSnapshotSerializer.js,
    'jest-preset-angular/build/AngularSnapshotSerializer.js',
    'jest-preset-angular/build/HTMLCommentSerializer.js'
  ]
`);
    });
  });

  describe('--support-tsx', () => {
    it('should add jest.transform', async () => {
      const resultTree = await runSchematic<JestProjectSchema>(
        'jest-project',
        {
          project: 'lib1',
          supportTsx: true,
        },
        appTree
      );
      const jestConfig = tags.stripIndents`${resultTree.readContent(
        'libs/lib1/jest.config.js'
      )}`;

      expect(jestConfig).toContain(
        tags.stripIndents`transform: {
          '^.+\\.[tj]sx?$':  'ts-jest'
        },`
      );
    });

    it('should add tsx to moduleExtensions', async () => {
      const resultTree = await runSchematic<JestProjectSchema>(
        'jest-project',
        {
          project: 'lib1',
          supportTsx: true,
        },
        appTree
      );
      const jestConfig = tags.stripIndents`${resultTree.readContent(
        'libs/lib1/jest.config.js'
      )}`;
      expect(jestConfig).toContain(
        `moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],`
      );
    });
  });

  describe('--babelJest', () => {
    it('should have globals.ts-jest configured when babelJest is false', async () => {
      const resultTree = await runSchematic<JestProjectSchema>(
        'jest-project',
        {
          project: 'lib1',
          babelJest: false,
        },
        appTree
      );
      const jestConfig = tags.stripIndents`${resultTree.readContent(
        'libs/lib1/jest.config.js'
      )}`;

      expect(jestConfig).toContain(
        tags.stripIndents`globals: {
          'ts-jest': {
            tsConfig: '<rootDir>/tsconfig.spec.json',
          }
        }`
      );
    });

    it('should NOT have globals.ts-jest configured when babelJest is true', async () => {
      const resultTree = await runSchematic<JestProjectSchema>(
        'jest-project',
        {
          project: 'lib1',
          babelJest: true,
        },
        appTree
      );
      const jestConfig = tags.stripIndents`${resultTree.readContent(
        'libs/lib1/jest.config.js'
      )}`;

      expect(jestConfig).not.toContain(
        tags.stripIndents`globals: {
          'ts-jest': {
            tsConfig: '<rootDir>/tsconfig.spec.json',
          }
        }`
      );
    });

    it('should generate proper jest.transform and babel-jest.config.json when babelJest is true', async () => {
      const resultTree = await runSchematic<JestProjectSchema>(
        'jest-project',
        {
          project: 'lib1',
          babelJest: true,
        },
        appTree
      );
      const jestConfig = tags.stripIndents`${resultTree.readContent(
        'libs/lib1/jest.config.js'
      )}`;

      expect(jestConfig).toContain(
        tags.stripIndents`transform: {
          '^.+\\.[tj]s$': [ 'babel-jest',
          { cwd: __dirname, configFile: './babel-jest.config.json' }]
          }`
      );

      expect(resultTree.exists('libs/lib1/babel-jest.config.json'));
      expect(readJsonInTree(resultTree, 'libs/lib1/babel-jest.config.json'))
        .toMatchInlineSnapshot(`
        Object {
          "presets": Array [
            Array [
              "@babel/preset-env",
              Object {
                "targets": Object {
                  "node": "current",
                },
              },
            ],
            "@babel/preset-typescript",
          ],
        }
      `);
    });

    it('should generate proper jest.transform and babel-jest.config.json when babelJest and supportTsx is true', async () => {
      const resultTree = await runSchematic<JestProjectSchema>(
        'jest-project',
        {
          project: 'lib1',
          babelJest: true,
          supportTsx: true,
        },
        appTree
      );
      const jestConfig = tags.stripIndents`${resultTree.readContent(
        'libs/lib1/jest.config.js'
      )}`;

      expect(jestConfig).toContain(
        tags.stripIndents`transform: {
          '^.+\\.[tj]sx?$': [ 'babel-jest',
          { cwd: __dirname, configFile: './babel-jest.config.json' }]
          }`
      );

      expect(readJsonInTree(resultTree, 'libs/lib1/babel-jest.config.json'))
        .toMatchInlineSnapshot(`
        Object {
          "presets": Array [
            Array [
              "@babel/preset-env",
              Object {
                "targets": Object {
                  "node": "current",
                },
              },
            ],
            "@babel/preset-typescript",
            "@babel/preset-react",
          ],
        }
      `);
    });
  });
});
