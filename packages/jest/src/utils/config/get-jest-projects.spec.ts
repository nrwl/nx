import { getJestProjects } from './get-jest-projects';
import * as Workspace from 'nx/src/project-graph/file-utils';
import type { WorkspaceJsonConfiguration } from '@nx/devkit';

describe('getJestProjects', () => {
  test('single project', () => {
    const mockedWorkspaceConfig: WorkspaceJsonConfiguration = {
      projects: {
        'test-1': {
          root: 'blah',
          targets: {
            test: {
              executor: '@nx/jest:jest',
              options: {
                jestConfig: 'test/jest/config/location/jest.config.js',
              },
            },
          },
        },
      },
      version: 1,
    };
    jest
      .spyOn(Workspace, 'readWorkspaceConfig')
      .mockImplementation(() => mockedWorkspaceConfig);
    const expectedResults = [
      '<rootDir>/test/jest/config/location/jest.config.js',
    ];
    expect(getJestProjects()).toEqual(expectedResults);
  });

  test('custom target name', () => {
    const mockedWorkspaceConfig: WorkspaceJsonConfiguration = {
      projects: {
        'test-1': {
          root: 'blah',
          targets: {
            'test-with-jest': {
              executor: '@nx/jest:jest',
              options: {
                jestConfig: 'test/jest/config/location/jest.config.js',
              },
            },
          },
        },
      },
      version: 1,
    };
    jest
      .spyOn(Workspace, 'readWorkspaceConfig')
      .mockImplementation(() => mockedWorkspaceConfig);
    const expectedResults = [
      '<rootDir>/test/jest/config/location/jest.config.js',
    ];
    expect(getJestProjects()).toEqual(expectedResults);
  });

  test('root project', () => {
    const mockedWorkspaceConfig: WorkspaceJsonConfiguration = {
      projects: {
        'test-1': {
          root: '.',
          targets: {
            test: {
              executor: '@nx/jest:jest',
              options: {
                jestConfig: 'jest.config.app.js',
              },
            },
          },
        },
      },
      version: 1,
    };
    jest
      .spyOn(Workspace, 'readWorkspaceConfig')
      .mockImplementation(() => mockedWorkspaceConfig);
    const expectedResults = ['<rootDir>/jest.config.app.js'];
    expect(getJestProjects()).toEqual(expectedResults);
  });

  test('configuration set with unique jestConfig', () => {
    const mockedWorkspaceConfig: WorkspaceJsonConfiguration = {
      projects: {
        test: {
          root: 'blah',
          targets: {
            'test-with-jest': {
              executor: '@nx/jest:jest',
              options: {
                jestConfig: 'test/jest/config/location/jest.config.js',
              },
              configurations: {
                prod: {
                  jestConfig: 'configuration-specific/jest.config.js',
                },
              },
            },
          },
        },
      },
      version: 1,
    };
    jest
      .spyOn(Workspace, 'readWorkspaceConfig')
      .mockImplementation(() => mockedWorkspaceConfig);
    const expectedResults = [
      '<rootDir>/test/jest/config/location/jest.config.js',
      '<rootDir>/configuration-specific/jest.config.js',
    ];
    expect(getJestProjects()).toEqual(expectedResults);
  });

  test('configuration, set with same jestConfig on configuration', () => {
    const mockedWorkspaceConfig: WorkspaceJsonConfiguration = {
      projects: {
        test: {
          root: 'blah',
          targets: {
            'test-with-jest': {
              executor: '@nx/jest:jest',
              options: {
                jestConfig: 'test/jest/config/location/jest.config.js',
              },
              configurations: {
                prod: {
                  jestConfig: 'test/jest/config/location/jest.config.js',
                },
              },
            },
          },
        },
      },
      version: 1,
    };
    jest
      .spyOn(Workspace, 'readWorkspaceConfig')
      .mockImplementation(() => mockedWorkspaceConfig);
    const expectedResults = [
      '<rootDir>/test/jest/config/location/jest.config.js',
    ];
    expect(getJestProjects()).toEqual(expectedResults);
  });

  test('other projects and targets that do not use the nrwl jest test runner', () => {
    const mockedWorkspaceConfig: WorkspaceJsonConfiguration = {
      projects: {
        otherTarget: {
          root: 'test',
          targets: {
            test: {
              executor: 'something else',
              options: {},
            },
          },
        },
        test: {
          root: 'blah',
          targets: {
            'test-with-jest': {
              executor: 'something else',
              options: {
                jestConfig: 'something random',
              },
              configurations: {
                prod: {
                  jestConfig: 'configuration-specific/jest.config.js',
                },
              },
            },
          },
        },
      },
      version: 1,
    };
    jest
      .spyOn(Workspace, 'readWorkspaceConfig')
      .mockImplementation(() => mockedWorkspaceConfig);
    const expectedResults = [];
    expect(getJestProjects()).toEqual(expectedResults);
  });
});
