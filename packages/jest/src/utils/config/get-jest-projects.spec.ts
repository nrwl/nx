import { getJestProjects } from './get-jest-projects';
import * as Workspace from 'nx/src/core/file-utils';
import type { WorkspaceJsonConfiguration } from '@nrwl/devkit';

describe('getJestProjects', () => {
  test('single project', () => {
    const mockedWorkspaceConfig: WorkspaceJsonConfiguration = {
      projects: {
        'test-1': {
          root: 'blah',
          targets: {
            test: {
              executor: '@nrwl/jest:jest',
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
    const expectedResults = ['<rootDir>/test/jest/config/location'];
    expect(getJestProjects()).toEqual(expectedResults);
  });

  test('custom target name', () => {
    const mockedWorkspaceConfig: WorkspaceJsonConfiguration = {
      projects: {
        'test-1': {
          root: 'blah',
          targets: {
            'test-with-jest': {
              executor: '@nrwl/jest:jest',
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
    const expectedResults = ['<rootDir>/test/jest/config/location'];
    expect(getJestProjects()).toEqual(expectedResults);
  });

  test('configuration set with unique jestConfig', () => {
    const mockedWorkspaceConfig: WorkspaceJsonConfiguration = {
      projects: {
        test: {
          root: 'blah',
          targets: {
            'test-with-jest': {
              executor: '@nrwl/jest:jest',
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
      '<rootDir>/test/jest/config/location',
      '<rootDir>/configuration-specific',
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
              executor: '@nrwl/jest:jest',
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
    const expectedResults = ['<rootDir>/test/jest/config/location'];
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
