import {
  addProjectConfiguration,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './stub-performance-mark-in-jest-test-setup';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: () => Promise.resolve(projectGraph),
}));

describe('stub-performance-mark-in-jest-test-setup migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add a stub for "performance.mark" for angular projects', async () => {
    addProject(
      tree,
      'app1',
      {
        name: 'app1',
        root: 'apps/app1',
        targets: {
          test: {
            executor: '@nx/jest:jest',
            options: { jestConfig: 'apps/app1/jest.config.ts' },
          },
        },
      },
      ['npm:@angular/core']
    );
    tree.write('apps/app1/jest.config.ts', jestConfigContents);
    tree.write('apps/app1/src/test-setup.ts', setupFileContents);

    await migration(tree);

    expect(tree.read('apps/app1/src/test-setup.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "// @ts-expect-error https://thymikee.github.io/jest-preset-angular/docs/getting-started/test-environment
      globalThis.ngJest = {
        testEnvironmentOptions: {
          errorOnUnknownElements: true,
          errorOnUnknownProperties: true,
        },
      };
      import 'jest-preset-angular/setup-jest';

      /**
       * Angular uses performance.mark() which is not supported by jsdom. Stub it out
       * to avoid errors.
       */
      global.performance.mark = jest.fn();
      "
    `);
  });

  it('should add a stub for "performance.mark" when using a custom setup file', async () => {
    addProject(
      tree,
      'app1',
      {
        name: 'app1',
        root: 'apps/app1',
        targets: {
          test: {
            executor: '@nx/jest:jest',
            options: { jestConfig: 'apps/app1/jest.config.ts' },
          },
        },
      },
      ['npm:@angular/core']
    );
    tree.write(
      'apps/app1/jest.config.ts',
      jestConfigContents.replace(
        `['<rootDir>/src/test-setup.ts']`,
        `['<rootDir>/src/custom-test-setup-file.ts']`
      )
    );
    tree.write('apps/app1/src/custom-test-setup-file.ts', setupFileContents);

    await migration(tree);

    expect(tree.exists('apps/app1/src/test-setup.ts')).toBe(false);
    expect(tree.read('apps/app1/src/custom-test-setup-file.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "// @ts-expect-error https://thymikee.github.io/jest-preset-angular/docs/getting-started/test-environment
      globalThis.ngJest = {
        testEnvironmentOptions: {
          errorOnUnknownElements: true,
          errorOnUnknownProperties: true,
        },
      };
      import 'jest-preset-angular/setup-jest';

      /**
       * Angular uses performance.mark() which is not supported by jsdom. Stub it out
       * to avoid errors.
       */
      global.performance.mark = jest.fn();
      "
    `);
  });

  it('should handle when there is no setup file and not throw', async () => {
    addProject(
      tree,
      'app1',
      {
        name: 'app1',
        root: 'apps/app1',
        targets: {
          test: {
            executor: '@nx/jest:jest',
            options: { jestConfig: 'apps/app1/jest.config.ts' },
          },
        },
      },
      ['npm:@angular/core']
    );
    tree.write(
      'apps/app1/jest.config.ts',
      jestConfigContents.replace(
        `setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],`,
        ''
      )
    );

    await expect(migration(tree)).resolves.not.toThrow();
  });

  it('should not add a stub for "performance.mark" for non-angular projects', async () => {
    addProject(
      tree,
      'app1',
      {
        name: 'app1',
        root: 'apps/app1',
        targets: {
          test: {
            executor: '@nx/jest:jest',
            options: { jestConfig: 'apps/app1/jest.config.ts' },
          },
        },
      },
      []
    );
    tree.write('apps/app1/jest.config.ts', jestConfigContents);
    tree.write('apps/app1/src/test-setup.ts', setupFileContents);

    await migration(tree);

    expect(tree.read('apps/app1/src/test-setup.ts', 'utf-8')).not.toContain(
      'global.performance.mark = jest.fn();'
    );
  });

  it('should not add a stub for "performance.mark" when it is already being accessed', async () => {
    addProject(
      tree,
      'app1',
      {
        name: 'app1',
        root: 'apps/app1',
        targets: {
          test: {
            executor: '@nx/jest:jest',
            options: { jestConfig: 'apps/app1/jest.config.ts' },
          },
        },
      },
      []
    );
    tree.write('apps/app1/jest.config.ts', jestConfigContents);
    tree.write(
      'apps/app1/src/test-setup.ts',
      `${setupFileContents}
global.performance.mark = require('perf_hooks').performance.mark;`
    );

    await migration(tree);

    expect(tree.read('apps/app1/src/test-setup.ts', 'utf-8')).not.toContain(
      'global.performance.mark = jest.fn();'
    );
  });
});

function addProject(
  tree: Tree,
  projectName: string,
  config: ProjectConfiguration,
  dependencies: string[]
): void {
  projectGraph = {
    dependencies: {
      [projectName]: dependencies.map((d) => ({
        source: projectName,
        target: d,
        type: 'static',
      })),
    },
    nodes: {
      [projectName]: { data: config, name: projectName, type: 'app' },
    },
  };
  addProjectConfiguration(tree, projectName, config);
}

const jestConfigContents = `
/* eslint-disable */
export default {
  displayName: 'foo',
  preset: './jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  coverageDirectory: './coverage/foo',
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.[jt]s?(x)',
    '<rootDir>/src/**/*(*.)@(spec|test).[jt]s?(x)',
  ],
};
`;

const setupFileContents = `
// @ts-expect-error https://thymikee.github.io/jest-preset-angular/docs/getting-started/test-environment
globalThis.ngJest = {
  testEnvironmentOptions: {
    errorOnUnknownElements: true,
    errorOnUnknownProperties: true,
  },
};
import 'jest-preset-angular/setup-jest';
`;
