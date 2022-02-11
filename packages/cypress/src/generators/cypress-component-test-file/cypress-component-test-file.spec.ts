import {
  ComponentTestingProjectState,
  cypressComponentTestingState,
} from '../utils/verify-cypress-component-project';
import {
  addProjectConfiguration,
  ProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import {
  cypressComponentTestFiles,
  normalizeOptions,
} from './cypress-component-test-file';

jest.mock('../utils/verify-cypress-component-project');
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
describe('Cypress Component Test File', () => {
  let tree: Tree;
  let mockedProjectState: jest.Mock<
    ReturnType<typeof cypressComponentTestingState>
  > = cypressComponentTestingState as never;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'cool-lib', projectConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should make cy.tsx file for Install state', async () => {
    mockedProjectState.mockReturnValue(ComponentTestingProjectState.INSTALL);
    cypressComponentTestFiles(tree, {
      project: 'cool-lib',
      componentType: 'react',
      name: 'CoolComponent',
    });
    expect(
      tree.exists('libs/cool-lib/src/lib/cool-component.cy.tsx')
    ).toBeTruthy();
  });

  it('should make cy.tsx file for NoInstall state', async () => {
    mockedProjectState.mockReturnValue(ComponentTestingProjectState.NO_INSTALL);
    cypressComponentTestFiles(tree, {
      project: 'cool-lib',
      componentType: 'react',
      name: 'CoolComponent',
    });
    expect(
      tree.exists('libs/cool-lib/src/lib/cool-component.cy.tsx')
    ).toBeTruthy();
  });

  it('should make cy.tsx file for AlreadySetup state', async () => {
    mockedProjectState.mockReturnValue(ComponentTestingProjectState.NO_INSTALL);
    cypressComponentTestFiles(tree, {
      project: 'cool-lib',
      componentType: 'react',
      name: 'CoolComponent',
    });
    expect(
      tree.exists('libs/cool-lib/src/lib/cool-component.cy.tsx')
    ).toBeTruthy();
  });

  it('should not make cy.tsx file for Upgrade state', async () => {
    mockedProjectState.mockReturnValue(ComponentTestingProjectState.UPGRADE);
    cypressComponentTestFiles(tree, {
      project: 'cool-lib',
      componentType: 'react',
      name: 'CoolComponent',
    });
    expect(
      tree.exists('libs/cool-lib/src/lib/cool-component.cy.tsx')
    ).toBeFalsy();
  });

  describe('directory normalization', () => {
    it('should use the passed in directory', () => {
      const actual = normalizeOptions(
        {
          directory: 'custom-dir/here',
          componentType: 'react',
          name: 'CoolComponent',
          project: 'cool-lib',
        },
        projectConfig
      );

      expect(actual).toMatchSnapshot();
    });

    it('should default to library directory', () => {
      const actual = normalizeOptions(
        {
          componentType: 'react',
          name: 'CoolComponent',
          project: 'cool-lib',
        },
        { ...projectConfig, projectType: 'library' }
      );

      expect(actual).toMatchSnapshot();
    });

    it('should default next spec directory', () => {
      const actual = normalizeOptions(
        {
          componentType: 'next',
          name: 'CoolComponent',
          project: 'cool-lib',
        },
        { ...projectConfig, projectType: 'application' }
      );

      expect(actual).toMatchSnapshot();
    });
  });

  it('should default react app directory', () => {
    const actual = normalizeOptions(
      {
        componentType: 'react',
        name: 'CoolComponent',
        project: 'cool-lib',
      },
      { ...projectConfig, projectType: 'application' }
    );

    expect(actual).toMatchSnapshot();
  });

  it('should fall through to sourceRoot', () => {
    const actual = normalizeOptions(
      {
        componentType: 'idk' as any,
        name: 'CoolComponent',
        project: 'cool-lib',
      },
      { ...projectConfig, projectType: 'blah!' } as any
    );

    expect(actual).toMatchSnapshot();
  });
});
