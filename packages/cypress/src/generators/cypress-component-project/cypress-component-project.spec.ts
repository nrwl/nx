import {
  addProjectConfiguration,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { CYPRESS_COMPONENT_TEST_TARGET } from '../../utils/project-name';

import { cypressComponentProject } from './cypress-component-project';

let projectConfig: ProjectConfiguration = {
  projectType: 'library',
  sourceRoot: 'libs/cool-lib/src',
  root: 'libs/cool-lib',
  targets: {
    build: {
      executor: '@nrwl/web:rollup',
      options: {
        tsConfig: 'libs/cool-lib/tsconfig.lib.json',
      },
    },
    test: {
      executor: '@nrwl/jest:jest',
      options: {
        jestConfig: 'libs/cool-lib/jest.config.js',
      },
    },
  },
};
describe('Cypress Component Project', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'cool-lib', projectConfig);
    tree.write(
      '.gitignore',
      `
# compiled output
/dist
/tmp
/out-tsc
    `
    );
    tree.write(
      'libs/cool-lib/tsconfig.lib.json',
      `
{
  "extends": "./tsconfig.json",
  "exclude": [
    "**/*.spec.ts",
    "**/*.test.ts",
    "**/*.spec.tsx",
    "**/*.test.tsx",
    "**/*.spec.js",
    "**/*.test.js",
    "**/*.spec.jsx",
    "**/*.test.jsx",
    "**/*.cy.ts"
  ],
  "include": [
    "**/*.js",
    "**/*.jsx",
    "**/*.ts",
    "**/*.tsx"
  ]
}
`
    );
    tree.write(
      'libs/cool-lib/tsconfig.json',
      `
{
  "references": [
    {
      "path": "./tsconfig.lib.json"
    },
    {
      "path": "./tsconfig.spec.json"
    }
  ]
}
`
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should not error when rerunning on an existing project', async () => {
    tree.write('libs/cool-lib/cypress.config.ts', '');
    const newTarget = {
      [CYPRESS_COMPONENT_TEST_TARGET]: {
        executor: '@nrwl/cypress:cypress',
        options: {
          cypressConfig: 'libs/cool-lib/cypress.config.ts',
          testingType: 'component',
        },
      },
    };
    updateProjectConfiguration(tree, 'cool-lib', {
      ...projectConfig,
      targets: {
        ...projectConfig.targets,
        ...newTarget,
      },
    });

    await cypressComponentProject(tree, {
      project: 'cool-lib',
      skipFormat: true,
    });
    const actualProjectConfig = readProjectConfiguration(tree, 'cool-lib');

    expect(tree.exists('libs/cool-lib/cypress.config.ts')).toEqual(true);
    expect(tree.exists('libs/cool-lib/cypress')).toEqual(true);
    expect(tree.exists('libs/cool-lib/tsconfig.cy.json')).toEqual(true);
    expect(
      actualProjectConfig.targets[CYPRESS_COMPONENT_TEST_TARGET]
    ).toMatchSnapshot();
  });
});
