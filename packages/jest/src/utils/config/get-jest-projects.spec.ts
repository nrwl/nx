import * as RetrieveWorkspaceFiles from 'nx/src/project-graph/utils/retrieve-workspace-files';
import { getJestProjects } from './get-jest-projects';

describe('getJestProjects', () => {
  test('single project', async () => {
    const mockedWorkspaceConfig: Partial<RetrieveWorkspaceFiles.RetrievedGraphNodes> =
      {
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
      };
    jest
      .spyOn(RetrieveWorkspaceFiles, 'retrieveProjectConfigurations')
      .mockResolvedValue(
        mockedWorkspaceConfig as RetrieveWorkspaceFiles.RetrievedGraphNodes
      );
    const expectedResults = [
      '<rootDir>/test/jest/config/location/jest.config.js',
    ];
    const projects = await getJestProjects();
    expect(projects).toEqual(expectedResults);
  });

  test('custom target name', async () => {
    const mockedWorkspaceConfig: Partial<RetrieveWorkspaceFiles.RetrievedGraphNodes> =
      {
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
      };
    jest
      .spyOn(RetrieveWorkspaceFiles, 'retrieveProjectConfigurations')
      .mockResolvedValue(
        mockedWorkspaceConfig as RetrieveWorkspaceFiles.RetrievedGraphNodes
      );
    const expectedResults = [
      '<rootDir>/test/jest/config/location/jest.config.js',
    ];
    const projects = await getJestProjects();
    expect(projects).toEqual(expectedResults);
  });

  test('root project', async () => {
    const mockedWorkspaceConfig: Partial<RetrieveWorkspaceFiles.RetrievedGraphNodes> =
      {
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
      };

    jest
      .spyOn(RetrieveWorkspaceFiles, 'retrieveProjectConfigurations')
      .mockResolvedValue(
        mockedWorkspaceConfig as RetrieveWorkspaceFiles.RetrievedGraphNodes
      );
    const expectedResults = ['<rootDir>/jest.config.app.js'];
    const projects = await getJestProjects();
    expect(projects).toEqual(expectedResults);
  });

  test('configuration set with unique jestConfig', async () => {
    const mockedWorkspaceConfig: Partial<RetrieveWorkspaceFiles.RetrievedGraphNodes> =
      {
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
      };
    jest
      .spyOn(RetrieveWorkspaceFiles, 'retrieveProjectConfigurations')
      .mockResolvedValue(
        mockedWorkspaceConfig as RetrieveWorkspaceFiles.RetrievedGraphNodes
      );
    const expectedResults = [
      '<rootDir>/test/jest/config/location/jest.config.js',
      '<rootDir>/configuration-specific/jest.config.js',
    ];
    const projects = await getJestProjects();
    expect(projects).toEqual(expectedResults);
  });

  test('configuration, set with same jestConfig on configuration', async () => {
    const mockedWorkspaceConfig: Partial<RetrieveWorkspaceFiles.RetrievedGraphNodes> =
      {
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
      };
    jest
      .spyOn(RetrieveWorkspaceFiles, 'retrieveProjectConfigurations')
      .mockResolvedValue(
        mockedWorkspaceConfig as RetrieveWorkspaceFiles.RetrievedGraphNodes
      );
    const expectedResults = [
      '<rootDir>/test/jest/config/location/jest.config.js',
    ];
    const projects = await getJestProjects();
    expect(projects).toEqual(expectedResults);
  });

  test('other projects and targets that do not use the nrwl jest test runner', async () => {
    const mockedWorkspaceConfig: Partial<RetrieveWorkspaceFiles.RetrievedGraphNodes> =
      {
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
      };
    jest
      .spyOn(RetrieveWorkspaceFiles, 'retrieveProjectConfigurations')
      .mockResolvedValue(
        mockedWorkspaceConfig as RetrieveWorkspaceFiles.RetrievedGraphNodes
      );
    const expectedResults = [];
    const projects = await getJestProjects();
    expect(projects).toEqual(expectedResults);
  });
});
