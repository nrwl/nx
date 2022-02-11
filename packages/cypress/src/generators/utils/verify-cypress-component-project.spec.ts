import { CYPRESS_COMPONENT_TEST_TARGET } from '../../utils/project-name';
import {
  addProjectConfiguration,
  ProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { installedCypressVersion } from '../../utils/cypress-version';
import {
  ComponentTestingProjectState,
  cypressComponentTestingState,
} from './verify-cypress-component-project';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

jest.mock('../../utils/cypress-version');
let projectConfig: ProjectConfiguration = {
  projectType: 'library',
  sourceRoot: 'libs/cool-lib/src',
  root: 'libs/cool-lib',
  targets: {
    test: {
      executor: '@nrwl/jest:jest',
      options: {
        jestConfig: 'libs/cool-lib/jest.config.js',
      },
    },
  },
};
describe('Cypress Component Project Validation', () => {
  let tree: Tree;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'cool-lib', projectConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be able to create project with cypress 10 installed', () => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    expect(
      cypressComponentTestingState(tree, projectConfig, {
        force: false,
      })
    ).toEqual(ComponentTestingProjectState.NO_INSTALL);
  });

  it('should not be able to create project with < cypress v9 installed', () => {
    mockedInstalledCypressVersion.mockReturnValue(9);

    expect(
      cypressComponentTestingState(tree, projectConfig, {
        force: false,
      })
    ).toEqual(ComponentTestingProjectState.UPGRADE);
  });

  it('should throw an error if cypress project is already created', () => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    tree.write('libs/cool-lib/cypress.config.ts', '');
    expect(
      cypressComponentTestingState(tree, projectConfig, {
        force: false,
      })
    ).toEqual(ComponentTestingProjectState.ALREADY_SETUP);
  });

  it('should create cypress project over existing with --force', () => {
    mockedInstalledCypressVersion.mockReturnValue(10);
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

    expect(
      cypressComponentTestingState(tree, projectConfig, {
        force: true,
      })
    ).toEqual(ComponentTestingProjectState.INSTALL);
  });
});
