import { addProjectConfiguration, Tree } from '@nrwl/devkit';
import { getJestObject } from '../update-10-0-0/require-jest-config';
import { jestConfigObject } from '../../utils/config/functions';
import update from './update-jest-preset-angular';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

jest.mock('../update-10-0-0/require-jest-config');
const getJestObjectMock = getJestObject as jest.Mock<typeof getJestObject>;

const jestExampleConfig1 = {
  globals: {
    'ts-jest': {
      astTransformers: {
        before: [
          'jest-preset-angular/build/InlineFilesTransformer',
          'jest-preset-angular/build/StripStylesTransformer',
        ],
      },
    },
  },
};

const jestExampleConfig2 = {
  preset: '../../../../../../jest.preset.js',
  transform: {
    '^.+\\.[tj]sx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
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
};

const jestExampleConfig3 = {
  testMatch: ['**/+(*.)+(spec|test).[tj]s?(x)'],
  globals: {
    'ts-jest': {
      tsConfig: 'lib/somepath/tsconfig.spec.json',
      stringifyContentPathRegex: '\\.(html|svg)$',
      astTransformers: {
        before: [
          // concatenated via "path.join(..)" in the real project
          'node_modules/jest-preset-angular/build/InlineFilesTransformer',
          'node_modules/jest-preset-angular/build/StripStylesTransformer',
        ],
      },
    },
  },
  resolver: '@nrwl/jest/plugins/resolver',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageReporters: ['html', 'lcov', 'json'],
  coverageThreshold: {
    global: {
      branches: 90,
      lines: 80,
      statements: 80,
    },
  },
};

[
  { name: 'jest config example 1', jestObject: jestExampleConfig1 },
  { name: 'jest example config 2', jestObject: jestExampleConfig2 },
  {
    name: 'testing when jest-preset-angular astTransform path is composed of node_modules etc..',
    jestObject: jestExampleConfig3,
  },
].forEach(({ name, jestObject }) => {
  describe(`Jest migration: ${name}`, () => {
    let tree: Tree;
    const jestConfig = String.raw`
    module.exports = ${JSON.stringify(jestObject, null, 2)}
  `;

    beforeEach(() => {
      getJestObjectMock.mockImplementation((path: string): any => {
        return jestObject;
      });

      tree = createTreeWithEmptyWorkspace();

      tree.write('apps/products/jest.config.js', jestConfig);
      tree.write('apps/products-2/jest.config.js', jestConfig);

      addProjectConfiguration(tree, 'products', {
        root: 'apps/products',
        sourceRoot: 'apps/products/src',
        targets: {
          build: {
            executor: '@nrwl/node:package',
          },
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'apps/products/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
      });

      addProjectConfiguration(tree, 'products-2', {
        root: 'apps/products-2',
        sourceRoot: 'apps/products-2/src',
        targets: {
          build: {
            executor: '@nrwl/angular:build',
          },
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'apps/products-2/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
      });
    });

    it('should update the jest.config files by removing astTransformers if using only jest-preset-angular', async () => {
      await update(tree);

      const jestObject = jestConfigObject(tree, 'apps/products/jest.config.js');

      expect(
        (jestObject.globals['ts-jest'] as { astTransformers: unknown })
          .astTransformers
      ).toBeUndefined();
    });

    it('should add transform if angular app', async () => {
      await update(tree);

      const jestObject = jestConfigObject(
        tree,
        'apps/products-2/jest.config.js'
      );

      expect(jestObject.transform).toEqual({
        ...jestObject.transform,
        '^.+\\.(ts|js|html)$': 'jest-preset-angular',
      });
    });

    it('should not add transform if non-angular app', async () => {
      getJestObjectMock.mockImplementation((path: string): any => {
        if (path.includes('apps/products')) {
          // return empty jest config without tsconfig
          return { globals: { 'ts-jest': {} } };
        }
      });

      await update(tree);

      const jestObject = jestConfigObject(tree, 'apps/products/jest.config.js');

      // should be the same as before
      expect(jestObject.transform).toEqual(jestObject.transform);
    });
  });
});
