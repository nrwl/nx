import {
  addProjectConfiguration,
  ProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { addBabelJestPresetTransformerOption } from './add-preset-jest-config';

function setup(
  tree: Tree,
  options: { buildName?: string; jestConfigContent: string }
) {
  const pc: ProjectConfiguration = {
    root: 'projects/my-proj',
    sourceRoot: 'projects/my-proj/src',
    targets: {
      ...(options.buildName
        ? {
            build: {
              executor: options.buildName,
              options: {},
            },
          }
        : {}),
      test: {
        executor: '@nrwl/jest:jest',
        options: {
          jestConfig: 'projects/my-proj/jest.config.ts',
        },
      },
    },
  };
  tree.write('projects/my-proj/jest.config.ts', options.jestConfigContent);
  addProjectConfiguration(tree, 'my-proj', pc);
}

describe('addBabelJestPresetTransformerOption', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });
  it('should add react preset to babel-jest transformer', () => {
    setup(tree, {
      jestConfigContent: `/* eslint-disable */
export default {
  displayName: 'my-proj',
  preset: '../../jest.preset.js',
  transform: {
    '^(?!.*\\\\\\\\.(js|jsx|ts|tsx|css|json)$)': '@nrwl/react/plugins/jest',
    '^.+\\\\\\\\.[tj]sx?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/projects/my-proj',
};`,
    });

    addBabelJestPresetTransformerOption(tree);
    expect(tree.read('projects/my-proj/jest.config.ts', 'utf-8')).toContain(
      `['babel-jest', { presets: ['@nrwl/react/babel'] }],`
    );
  });

  it('should not update if babel-jest is not being used', () => {
    setup(tree, {
      jestConfigContent: `/* eslint-disable */
export default {
  displayName: 'my-proj',
  preset: '../../jest.preset.js',
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    },
  },
  testEnvironment: 'node',
  transform: {
    '^.+\\\\\\\\.[tj]s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/projects/my-proj',
};`,
    });

    addBabelJestPresetTransformerOption(tree);
    expect(tree.read('projects/my-proj/jest.config.ts', 'utf-8')).not.toContain(
      'babel-jest'
    );
  });

  it('should not update if next project', () => {
    setup(tree, {
      buildName: '@nrwl/next:build',
      jestConfigContent: `
/* eslint-disable */
export default {
  displayName: 'my-proj',
  preset: '../../jest.preset.js',
  transform: {
    '^(?!.*\\\\.(js|jsx|ts|tsx|css|json)$)': '@nrwl/react/plugins/jest',
    '^.+\\\\.[tj]sx?$': ['babel-jest', { presets: ['@nrwl/next/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/apps/my-proj',
};
`,
    });
    addBabelJestPresetTransformerOption(tree);
    expect(tree.read('projects/my-proj/jest.config.ts', 'utf-8')).toContain(
      `'^.+\\\\.[tj]sx?$': ['babel-jest', { presets: ['@nrwl/next/babel'] }],`
    );
  });

  it('should not update if js project', () => {
    setup(tree, {
      buildName: '@nrwl/js:tsc',
      jestConfigContent: `/* eslint-disable */
export default {
  displayName: 'my-proj',
  preset: '../../jest.preset.js',
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    },
  },
  transform: {
    '^.+\\\\.[tj]s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/projects/my-proj',
};`,
    });

    addBabelJestPresetTransformerOption(tree);
    expect(tree.read('projects/my-proj/jest.config.ts', 'utf-8')).not.toContain(
      'babel-jest'
    );
  });

  it('should not update if a angular project', () => {
    setup(tree, {
      buildName: '@angular-devkit/build-angular:browser',
      jestConfigContent: `/* eslint-disable */
export default {
  displayName: 'my-proj',
  preset: '../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
      stringifyContentPathRegex: '\\\\.(html|svg)$',
    },
  },
  coverageDirectory: '../../coverage/projects/my-proj',
  transform: {
    '^.+\\\\.(ts|mjs|js|html)$': 'jest-preset-angular',
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\\\.mjs$|nanoid)'],
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
};`,
    });
    addBabelJestPresetTransformerOption(tree);
    expect(tree.read('projects/my-proj/jest.config.ts', 'utf-8')).not.toContain(
      'babel-jest'
    );
  });

  it('should not update if workspace project', () => {
    setup(tree, {
      buildName: '@nrwl/node:webpack',
      jestConfigContent: `/* eslint-disable */
export default {
  displayName: 'my-proj',
  preset: '../../jest.preset.js',
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    },
  },
  transform: {
    '^.+\\\\.[tj]sx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/projects/my-proj',
};`,
    });

    addBabelJestPresetTransformerOption(tree);
    expect(tree.read('projects/my-proj/jest.config.ts', 'utf-8')).not.toContain(
      'babel-jest'
    );
  });
});
