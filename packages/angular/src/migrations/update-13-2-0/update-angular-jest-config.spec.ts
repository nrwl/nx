import { addProjectConfiguration } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { replaceTransformAndAddIgnorePattern } from './update-angular-jest-config';
import updateAngularJestConfig from './update-angular-jest-config';

describe('update-angular-jest-config migration', () => {
  it('should migrate the jest config', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app', {
      root: 'apps/testing',
      targets: {
        test: {
          executor: '@nrwl/jest:jest',
          options: {
            jestConfig: 'apps/testing/jest.config.js',
          },
        },
      },
    });

    const jestConfig = `module.exports = {
        displayName: 'app1',
        preset: '../../jest.preset.js',
        setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
        globals: {
          'ts-jest': {
            tsconfig: '<rootDir>/tsconfig.spec.json',
            stringifyContentPathRegex: '\\.(html|svg)$',
          },
        },
        coverageDirectory: '../../coverage/apps/app1',
        transform: {
        '^.+\\.(ts|js|html)$': 'jest-preset-angular',
        },
        snapshotSerializers: [
          'jest-preset-angular/build/serializers/no-ng-attributes',
          'jest-preset-angular/build/serializers/ng-snapshot',
          'jest-preset-angular/build/serializers/html-comment',
        ],
        };`;

    tree.write('apps/testing/jest.config.js', jestConfig);

    // ACT
    await updateAngularJestConfig(tree);

    // ASSERT
    const updatedJestFile = tree.read('apps/testing/jest.config.js', 'utf-8');
    expect(updatedJestFile).toMatchSnapshot();
  });
});

describe('ast transformations', () => {
  it('should replace the transformer and add the ignore pattern correctly', () => {
    // ARRANGE
    const jestConfig = `module.exports = {
displayName: 'app1',
preset: '../../jest.preset.js',
setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
globals: {
  'ts-jest': {
    tsconfig: '<rootDir>/tsconfig.spec.json',
    stringifyContentPathRegex: '\\.(html|svg)$',
  },
},
coverageDirectory: '../../coverage/apps/app1',
transform: {
'^.+\\.(ts|js|html)$': 'jest-preset-angular',
},
snapshotSerializers: [
  'jest-preset-angular/build/serializers/no-ng-attributes',
  'jest-preset-angular/build/serializers/ng-snapshot',
  'jest-preset-angular/build/serializers/html-comment',
],
};`;

    // ACT
    const updatedFile = replaceTransformAndAddIgnorePattern(jestConfig);

    // ASSERT
    expect(updatedFile).toMatchInlineSnapshot(`
      "module.exports = {
      displayName: 'app1',
      preset: '../../jest.preset.js',
      setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
      globals: {
        'ts-jest': {
          tsconfig: '<rootDir>/tsconfig.spec.json',
          stringifyContentPathRegex: '\\\\.(html|svg)$',
        },
      },
      coverageDirectory: '../../coverage/apps/app1',
      transform: {
      '^.+\\\\.(ts|mjs|js|html)$': 'jest-preset-angular',
      },
      transformIgnorePatterns: ['node_modules/(?!.*\\\\.mjs$)'],
      snapshotSerializers: [
        'jest-preset-angular/build/serializers/no-ng-attributes',
        'jest-preset-angular/build/serializers/ng-snapshot',
        'jest-preset-angular/build/serializers/html-comment',
      ],
      };"
    `);
  });

  it('should replace the transformer and add the ignore pattern correctly regardless of additional transformers', () => {
    // ARRANGE
    const jestConfig = `module.exports = {
displayName: 'app1',
preset: '../../jest.preset.js',
setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
globals: {
  'ts-jest': {
    tsconfig: '<rootDir>/tsconfig.spec.json',
    stringifyContentPathRegex: '\\.(html|svg)$',
  },
},
coverageDirectory: '../../coverage/apps/app1',
transform: {
'^.+\\.(ts|js|html)$': 'jest-preset-angular',
'^.+\\.(json)$': 'json_transformer',
},
snapshotSerializers: [
  'jest-preset-angular/build/serializers/no-ng-attributes',
  'jest-preset-angular/build/serializers/ng-snapshot',
  'jest-preset-angular/build/serializers/html-comment',
],
};`;

    // ACT
    const updatedFile = replaceTransformAndAddIgnorePattern(jestConfig);

    // ASSERT
    expect(updatedFile).toMatchInlineSnapshot(`
      "module.exports = {
      displayName: 'app1',
      preset: '../../jest.preset.js',
      setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
      globals: {
        'ts-jest': {
          tsconfig: '<rootDir>/tsconfig.spec.json',
          stringifyContentPathRegex: '\\\\.(html|svg)$',
        },
      },
      coverageDirectory: '../../coverage/apps/app1',
      transform: {
      '^.+\\\\.(ts|mjs|js|html)$': 'jest-preset-angular',
      '^.+\\\\.(json)$': 'json_transformer',
      },
      transformIgnorePatterns: ['node_modules/(?!.*\\\\.mjs$)'],
      snapshotSerializers: [
        'jest-preset-angular/build/serializers/no-ng-attributes',
        'jest-preset-angular/build/serializers/ng-snapshot',
        'jest-preset-angular/build/serializers/html-comment',
      ],
      };"
    `);
  });

  it('should replace the transformer and add the ignore pattern correctly regardless of additional serializers', () => {
    // ARRANGE
    const jestConfig = `module.exports = {
displayName: 'app1',
preset: '../../jest.preset.js',
setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
globals: {
  'ts-jest': {
    tsconfig: '<rootDir>/tsconfig.spec.json',
    stringifyContentPathRegex: '\\.(html|svg)$',
  },
},
coverageDirectory: '../../coverage/apps/app1',
transform: {
'^.+\\.(json)$': 'json_transformer',
'^.+\\.(ts|js|html)$': 'jest-preset-angular',
}
};`;

    // ACT
    const updatedFile = replaceTransformAndAddIgnorePattern(jestConfig);

    // ASSERT
    expect(updatedFile).toMatchInlineSnapshot(`
      "module.exports = {
      displayName: 'app1',
      preset: '../../jest.preset.js',
      setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
      globals: {
        'ts-jest': {
          tsconfig: '<rootDir>/tsconfig.spec.json',
          stringifyContentPathRegex: '\\\\.(html|svg)$',
        },
      },
      coverageDirectory: '../../coverage/apps/app1',
      transform: {
      '^.+\\\\.(json)$': 'json_transformer',
      '^.+\\\\.(ts|mjs|js|html)$': 'jest-preset-angular',
      },
      transformIgnorePatterns: ['node_modules/(?!.*\\\\.mjs$)'],
      };"
    `);
  });

  it('should not transform contents of unmatching configs', () => {
    // ARRANGE
    const jestConfig = `module.exports = {
      preset: '../../jest.preset.js',
      coverageDirectory: '../../coverage/libs/common-platform',
      setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
      globals: {
        'ts-jest': {
          stringifyContentPathRegex: '\\\\.(html|svg)$',
          astTransformers: [
            'jest-preset-angular/build/InlineFilesTransformer',
            'jest-preset-angular/build/StripStylesTransformer',
          ],
          tsconfig: '<rootDir>/tsconfig.spec.json',
        },
      },
      displayName: 'common-platform',
    };
    `;

    // ACT
    const updatedFile = replaceTransformAndAddIgnorePattern(jestConfig);

    // ASSERT
    expect(updatedFile).toMatchInlineSnapshot(`
      "module.exports = {
            preset: '../../jest.preset.js',
            coverageDirectory: '../../coverage/libs/common-platform',
            setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
            globals: {
              'ts-jest': {
                stringifyContentPathRegex: '\\\\\\\\.(html|svg)$',
                astTransformers: [
                  'jest-preset-angular/build/InlineFilesTransformer',
                  'jest-preset-angular/build/StripStylesTransformer',
                ],
                tsconfig: '<rootDir>/tsconfig.spec.json',
              },
            },
            displayName: 'common-platform',
          };
          "
    `);
  });

  it('should not add multiple transform ignore patterns', () => {
    // ARRANGE
    const jestConfig = `module.exports = {
      displayName: 'app1',
      preset: '../../jest.preset.js',
      setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
      globals: {
        'ts-jest': {
          tsconfig: '<rootDir>/tsconfig.spec.json',
          stringifyContentPathRegex: '\\.(html|svg)$',
        },
      },
      coverageDirectory: '../../coverage/apps/app1',
      transform: {
      '^.+\\.(json)$': 'json_transformer',
      '^.+\\.(ts|js|html)$': 'jest-preset-angular',
      },
      transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
      };`;

    // ACT
    const updatedFile = replaceTransformAndAddIgnorePattern(jestConfig);

    // ASSERT
    expect(updatedFile).toMatchInlineSnapshot(`
      "module.exports = {
            displayName: 'app1',
            preset: '../../jest.preset.js',
            setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
            globals: {
              'ts-jest': {
                tsconfig: '<rootDir>/tsconfig.spec.json',
                stringifyContentPathRegex: '\\\\.(html|svg)$',
              },
            },
            coverageDirectory: '../../coverage/apps/app1',
            transform: {
            '^.+\\\\.(json)$': 'json_transformer',
      '^.+\\\\.(ts|mjs|js|html)$': 'jest-preset-angular',
            },
            transformIgnorePatterns: ['node_modules/(?!.*\\\\.mjs$)'],
            };"
    `);
  });
});
