let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));

import {
  addProjectConfiguration as _addProjectConfiguration,
  readProjectConfiguration,
  stripIndents,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { createJestConfig } from './create-jest-config';

function addProjectConfiguration(
  tree: Tree,
  name: string,
  project: ProjectConfiguration
) {
  _addProjectConfiguration(tree, name, project);
  projectGraph.nodes[name] = {
    name: name,
    type: 'lib',
    data: {
      root: project.root,
      targets: project.targets,
    },
  };
}

describe('createJestConfig', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    projectGraph = {
      nodes: {},
      dependencies: {},
      externalNodes: {},
    };
  });

  it('should generate files with --js flag', async () => {
    await createJestConfig(tree, { js: true }, 'js');

    expect(tree.exists('jest.config.js')).toBeTruthy();
    expect(
      stripIndents`${tree.read('jest.config.js', 'utf-8')}`
    ).toMatchSnapshot();
    expect(
      stripIndents`${tree.read('jest.preset.js', 'utf-8')}`
    ).toMatchSnapshot();
  });

  it('should generate files ', async () => {
    await createJestConfig(tree, {}, 'js');

    expect(tree.exists('jest.config.ts')).toBeTruthy();
    expect(
      stripIndents`${tree.read('jest.config.ts', 'utf-8')}`
    ).toMatchSnapshot();
    expect(
      stripIndents`${tree.read('jest.preset.js', 'utf-8')}`
    ).toMatchSnapshot();
  });

  it('should not override existing files', async () => {
    addProjectConfiguration(tree, 'my-project', {
      root: 'apps/my-app',
      name: 'my-app',
      sourceRoot: 'apps/my-app/src',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'apps/my-app/jest.config.ts',
          },
        },
      },
    });
    const expected = stripIndents`
import { getJestProjects } from '@nx/jest';
export default {
  projects: getJestProjects(),
  extraThing: "Goes Here"
}
`;
    tree.write('jest.config.ts', expected);

    await createJestConfig(tree, {}, 'js');

    expect(tree.read('jest.config.ts', 'utf-8')).toEqual(expected);
  });

  it('should make js jest files', async () => {
    await createJestConfig(tree, { js: true }, 'js');

    expect(tree.exists('jest.config.js')).toBeTruthy();
    expect(tree.exists('jest.preset.js')).toBeTruthy();
  });

  describe('root project', () => {
    it('should not add a monorepo jest.config.ts  to the project', async () => {
      await createJestConfig(tree, { rootProject: true }, 'js');

      expect(tree.exists('jest.config.ts')).toBeFalsy();
    });

    it('should rename the project jest.config.ts to project jest config', async () => {
      addProjectConfiguration(tree, 'my-project', {
        root: '.',
        name: 'my-project',
        projectType: 'application',
        sourceRoot: 'src',
        targets: {
          test: {
            executor: '@nx/jest:jest',
            options: {
              jestConfig: 'jest.config.ts',
            },
          },
        },
      });
      tree.write(
        'jest.config.ts',
        `
/* eslint-disable */
export default {
  transform: {
    '^.+\\.[tj]sx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  globals: { 'ts-jest': { tsconfig: '<rootDir>/tsconfig.spec.json' } },
  displayName: 'my-project',
  testEnvironment: 'node',
  preset: './jest.preset.js',
};
`
      );

      await createJestConfig(tree, { rootProject: false }, 'js');

      expect(tree.exists('jest.config.app.ts')).toBeTruthy();
      expect(tree.read('jest.config.app.ts', 'utf-8')).toMatchInlineSnapshot(`
        "
        /* eslint-disable */
        export default {
          transform: {
            '^.+\\.[tj]sx?$': 'ts-jest',
          },
          moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
          globals: { 'ts-jest': { tsconfig: '<rootDir>/tsconfig.spec.json' } },
          displayName: 'my-project',
          testEnvironment: 'node',
          preset: './jest.preset.js',
        };
        "
      `);
      expect(tree.read('jest.config.ts', 'utf-8'))
        .toEqual(`import { getJestProjects } from '@nx/jest';

export default {
projects: getJestProjects()
};`);
      expect(readProjectConfiguration(tree, 'my-project').targets.test)
        .toMatchInlineSnapshot(`
        {
          "executor": "@nx/jest:jest",
          "options": {
            "jestConfig": "jest.config.app.ts",
          },
        }
      `);
    });

    it('should work with --js', async () => {
      addProjectConfiguration(tree, 'my-project', {
        root: '.',
        name: 'my-project',
        sourceRoot: 'src',
        projectType: 'application',
        targets: {
          test: {
            executor: '@nx/jest:jest',
            options: {
              jestConfig: 'jest.config.js',
            },
          },
        },
      });
      tree.write(
        'jest.config.js',
        `
/* eslint-disable */
module.exports = {
  transform: {
    '^.+\\.[tj]sx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  globals: { 'ts-jest': { tsconfig: '<rootDir>/tsconfig.spec.json' } },
  displayName: 'my-project',
  testEnvironment: 'node',
  preset: './jest.preset.js',
};
`
      );

      await createJestConfig(tree, { js: true, rootProject: false }, 'js');

      expect(tree.exists('jest.config.app.js')).toBeTruthy();
      expect(tree.read('jest.config.js', 'utf-8'))
        .toEqual(`const { getJestProjects } = require('@nx/jest');

module.exports = {
projects: getJestProjects()
};`);
    });
  });
});
