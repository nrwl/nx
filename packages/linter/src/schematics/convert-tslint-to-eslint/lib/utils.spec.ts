import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import type { Linter } from 'eslint';
import {
  isAngularProject,
  isE2EProject,
  updateArrPropAndRemoveDuplication,
  updateObjPropAndRemoveDuplication,
} from './utils';

describe('utils', () => {
  describe('updateArrPropAndRemoveDuplication()', () => {
    interface TestCase {
      json: Linter.Config;
      configBeingExtended: Linter.Config;
      arrPropName: string;
      deleteIfUltimatelyEmpty: boolean;
      expectedJSON: Linter.Config;
    }

    const testCases: TestCase[] = [
      {
        json: {
          extends: ['eslint:recommended'],
        },
        configBeingExtended: {
          extends: ['eslint:recommended'],
        },
        arrPropName: 'extends',
        deleteIfUltimatelyEmpty: true,
        expectedJSON: {},
      },
      {
        json: {
          extends: ['eslint:recommended'],
        },
        configBeingExtended: {
          extends: ['eslint:recommended'],
        },
        arrPropName: 'extends',
        deleteIfUltimatelyEmpty: false,
        expectedJSON: {
          extends: [],
        },
      },
      {
        json: {
          extends: ['eslint:recommended', 'something-custom'],
        },
        configBeingExtended: {
          extends: [
            'eslint:recommended',
            'plugin:@typescript-eslint/eslint-recommended',
            'plugin:@typescript-eslint/recommended',
            'prettier',
            'prettier/@typescript-eslint',
          ],
        },
        arrPropName: 'extends',
        deleteIfUltimatelyEmpty: false,
        expectedJSON: {
          extends: ['something-custom'],
        },
      },
      {
        json: {
          plugins: ['@typescript-eslint', 'some-entirely-custom-user-plugin'],
        },
        configBeingExtended: {
          plugins: ['@typescript-eslint'],
        },
        arrPropName: 'plugins',
        deleteIfUltimatelyEmpty: true,
        expectedJSON: {
          plugins: ['some-entirely-custom-user-plugin'],
        },
      },
    ];

    testCases.forEach((tc, i) => {
      it(`should remove duplication between the array property of the first-party config and the config being extended, CASE ${i}`, () => {
        updateArrPropAndRemoveDuplication(
          tc.json,
          tc.configBeingExtended,
          tc.arrPropName,
          tc.deleteIfUltimatelyEmpty
        );
        expect(tc.json).toEqual(tc.expectedJSON);
      });
    });
  });

  describe('updateObjPropAndRemoveDuplication()', () => {
    interface TestCase {
      json: Linter.Config;
      configBeingExtended: Linter.Config;
      objPropName: string;
      deleteIfUltimatelyEmpty: boolean;
      expectedJSON: Linter.Config;
    }

    const testCases: TestCase[] = [
      {
        json: {},
        configBeingExtended: {},
        objPropName: 'rules',
        deleteIfUltimatelyEmpty: false,
        expectedJSON: {
          rules: {},
        },
      },
      {
        json: {},
        configBeingExtended: {},
        objPropName: 'rules',
        deleteIfUltimatelyEmpty: true,
        expectedJSON: {},
      },
      {
        json: {
          rules: {
            '@typescript-eslint/explicit-member-accessibility': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-parameter-properties': 'off',
          },
        },
        configBeingExtended: {
          rules: {
            '@typescript-eslint/explicit-member-accessibility': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-parameter-properties': 'off',
          },
        },
        objPropName: 'rules',
        deleteIfUltimatelyEmpty: false,
        expectedJSON: {
          rules: {},
        },
      },
      {
        json: {
          rules: {
            'extra-rule-in-first-party': 'error',
            'rule-1-same-despite-options-order': [
              'error',
              { configOption1: true, configOption2: 'SOMETHING' },
            ],
            'rule-2-different-severity': ['off'],
            'rule-3-same-severity-different-options': [
              'error',
              {
                a: false,
              },
            ],
          },
        },
        configBeingExtended: {
          rules: {
            'extra-rule-in-extended': 'error',
            'rule-1-same-despite-options-order': [
              'error',
              { configOption2: 'SOMETHING', configOption1: true },
            ],
            'rule-2-different-severity': ['error'],
            'rule-3-same-severity-different-options': [
              'error',
              {
                a: true,
              },
            ],
          },
        },
        objPropName: 'rules',
        deleteIfUltimatelyEmpty: false,
        expectedJSON: {
          rules: {
            'extra-rule-in-first-party': 'error',
            'rule-2-different-severity': ['off'],
            'rule-3-same-severity-different-options': [
              'error',
              {
                a: false,
              },
            ],
          },
        },
      },
      {
        json: {
          settings: { react: { version: 'detect' } },
        },
        configBeingExtended: {
          settings: { react: { version: 'detect' } },
        },
        objPropName: 'settings',
        deleteIfUltimatelyEmpty: true,
        expectedJSON: {},
      },
      {
        json: {
          // Different env in first party config
          env: {
            browser: true,
            commonjs: false,
            es6: false,
            jest: true,
            node: true,
          },
        },
        configBeingExtended: {
          env: {
            browser: true,
            commonjs: true,
            es6: true,
            jest: true,
            node: false,
          },
        },
        objPropName: 'env',
        deleteIfUltimatelyEmpty: true,
        expectedJSON: {
          env: {
            commonjs: false,
            es6: false,
            node: true,
          },
        },
      },
    ];

    testCases.forEach((tc, i) => {
      it(`should remove duplication between the object property of the first-party config and the config being extended, CASE ${i}`, () => {
        updateObjPropAndRemoveDuplication(
          tc.json,
          tc.configBeingExtended,
          tc.objPropName,
          tc.deleteIfUltimatelyEmpty
        );
        expect(tc.json).toEqual(tc.expectedJSON);
      });
    });
  });

  describe('Angular vs e2e vs other projects inference', () => {
    const angularApplicationProjectConfig = {
      projectType: 'application',
      root: 'apps/ngappone',
      sourceRoot: 'apps/ngappone/src',
      prefix: 'v13819',
      architect: {
        build: {
          builder: '@angular-devkit/build-angular:browser',
          options: {
            outputPath: 'dist/apps/ngappone',
            index: 'apps/ngappone/src/index.html',
            main: 'apps/ngappone/src/main.ts',
            polyfills: 'apps/ngappone/src/polyfills.ts',
            tsConfig: 'apps/ngappone/tsconfig.app.json',
            aot: true,
            assets: [
              'apps/ngappone/src/favicon.ico',
              'apps/ngappone/src/assets',
            ],
            styles: ['apps/ngappone/src/styles.css'],
            scripts: [],
          },
          configurations: {
            production: {
              fileReplacements: [
                {
                  replace: 'apps/ngappone/src/environments/environment.ts',
                  with: 'apps/ngappone/src/environments/environment.prod.ts',
                },
              ],
              optimization: true,
              outputHashing: 'all',
              sourceMap: false,
              namedChunks: false,
              extractLicenses: true,
              vendorChunk: false,
              buildOptimizer: true,
              budgets: [
                {
                  type: 'initial',
                  maximumWarning: '2mb',
                  maximumError: '5mb',
                },
                {
                  type: 'anyComponentStyle',
                  maximumWarning: '6kb',
                  maximumError: '10kb',
                },
              ],
            },
          },
        },
        serve: {
          builder: '@angular-devkit/build-angular:dev-server',
          options: {
            browserTarget: 'ngappone:build',
          },
          configurations: {
            production: {
              browserTarget: 'ngappone:build:production',
            },
          },
        },
        'extract-i18n': {
          builder: '@angular-devkit/build-angular:extract-i18n',
          options: {
            browserTarget: 'ngappone:build',
          },
        },
        lint: {
          builder: '@nrwl/linter:eslint',
          options: {
            lintFilePatterns: [
              'apps/ngappone/src/**/*.ts',
              'apps/ngappone/src/**/*.html',
            ],
          },
        },
        test: {
          builder: '@nrwl/jest:jest',
          outputs: ['coverage/apps/ngappone'],
          options: {
            jestConfig: 'apps/ngappone/jest.config.js',
            passWithNoTests: true,
          },
        },
      },
    };

    const angularLibraryProjectConfig = {
      projectType: 'library',
      root: 'libs/nglibone',
      sourceRoot: 'libs/nglibone/src',
      prefix: 'v13819',
      architect: {
        lint: {
          builder: '@angular-devkit/build-angular:tslint',
          options: {
            tsConfig: [
              'libs/nglibone/tsconfig.lib.json',
              'libs/nglibone/tsconfig.spec.json',
            ],
            exclude: ['**/node_modules/**', '!libs/nglibone/**/*'],
          },
        },
        test: {
          builder: '@nrwl/jest:jest',
          outputs: ['coverage/libs/nglibone'],
          options: {
            jestConfig: 'libs/nglibone/jest.config.js',
            passWithNoTests: true,
          },
        },
      },
    };

    const e2eProjectConfig = {
      root: 'apps/ngappone-e2e',
      sourceRoot: 'apps/ngappone-e2e/src',
      projectType: 'application',
      architect: {
        e2e: {
          builder: '@nrwl/cypress:cypress',
          options: {
            cypressConfig: 'apps/ngappone-e2e/cypress.json',
            tsConfig: 'apps/ngappone-e2e/tsconfig.e2e.json',
            devServerTarget: 'ngappone:serve',
          },
          configurations: {
            production: {
              devServerTarget: 'ngappone:serve:production',
            },
          },
        },
        lint: {
          builder: '@nrwl/linter:eslint',
          options: {
            lintFilePatterns: [
              'apps/ngappone-e2e/src/**/*.ts',
              'apps/ngappone-e2e/src/**/*.html',
            ],
          },
        },
      },
    };

    const otherProjectConfig = {
      root: 'apps/foo',
      sourceRoot: 'apps/foo/src',
      projectType: 'application',
      prefix: 'foo',
      architect: {
        build: {
          builder: '@nrwl/node:build',
          outputs: ['{options.outputPath}'],
          options: {
            outputPath: 'dist/apps/foo',
            main: 'apps/foo/src/main.ts',
            tsConfig: 'apps/foo/tsconfig.app.json',
            assets: ['apps/foo/src/assets'],
          },
          configurations: {
            production: {
              optimization: true,
              extractLicenses: true,
              inspect: false,
              fileReplacements: [
                {
                  replace: 'apps/foo/src/environments/environment.ts',
                  with: 'apps/foo/src/environments/environment.prod.ts',
                },
              ],
            },
          },
        },
        serve: {
          builder: '@nrwl/node:execute',
          options: {
            buildTarget: 'foo:build',
          },
        },
        lint: {
          builder: '@angular-devkit/build-angular:tslint',
          options: {
            tsConfig: [
              'apps/foo/tsconfig.app.json',
              'apps/foo/tsconfig.spec.json',
            ],
            exclude: ['**/node_modules/**', '!apps/foo/**/*'],
          },
        },
        test: {
          builder: '@nrwl/jest:jest',
          outputs: ['coverage/apps/foo'],
          options: {
            jestConfig: 'apps/foo/jest.config.js',
            passWithNoTests: true,
          },
        },
      },
    };

    let tree: Tree;

    beforeEach(async () => {
      tree = Tree.empty();
      tree = createEmptyWorkspace(tree);
      tree.create(
        'libs/nglibone/jest.config.js',
        `module.exports = {
      displayName: 'nglibone',
      preset: '../../jest.preset.js',
      setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
      globals: {
        'ts-jest': {
          tsConfig: '<rootDir>/tsconfig.spec.json',
          stringifyContentPathRegex: '\\.(html|svg)$',
          astTransformers: {
            before: [
              'jest-preset-angular/build/InlineFilesTransformer',
              'jest-preset-angular/build/StripStylesTransformer',
            ],
          },
        },
      },
      coverageDirectory: '../../coverage/libs/nglibone',
      snapshotSerializers: [
        'jest-preset-angular/build/AngularNoNgAttributesSnapshotSerializer.js',
        'jest-preset-angular/build/AngularSnapshotSerializer.js',
        'jest-preset-angular/build/HTMLCommentSerializer.js',
      ],
    };
    `
      );
    });

    describe('isAngularProject()', () => {
      it('should return true if the project is inferred to be an Angular project', () => {
        expect(isAngularProject(tree, angularApplicationProjectConfig)).toEqual(
          true
        );
        expect(isAngularProject(tree, angularLibraryProjectConfig)).toEqual(
          true
        );

        expect(isAngularProject(tree, e2eProjectConfig)).toEqual(false);
        expect(isAngularProject(tree, otherProjectConfig)).toEqual(false);
      });
    });

    describe('isE2EProject()', () => {
      it('should return true if the project is inferred to be an e2e project', () => {
        expect(
          isE2EProject('ngappone', angularApplicationProjectConfig)
        ).toEqual(false);
        expect(isE2EProject('nglibone', angularLibraryProjectConfig)).toEqual(
          false
        );

        expect(isE2EProject('ngappone-e2e', e2eProjectConfig)).toEqual(true);
        expect(isE2EProject('foo', otherProjectConfig)).toEqual(false);
      });
    });
  });
});
