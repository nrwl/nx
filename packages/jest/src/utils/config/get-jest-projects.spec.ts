import type {
  ProjectConfiguration,
  ProjectGraph,
  WorkspaceJsonConfiguration,
} from '@nx/devkit';
import * as devkit from '@nx/devkit';
import * as Workspace from 'nx/src/project-graph/file-utils';
import { getJestProjects, getJestProjectsAsync } from './get-jest-projects';

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

  test('other projects and targets that do not use the nx jest test runner', () => {
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

describe('getJestProjectsAsync', () => {
  let projectGraph: ProjectGraph;

  function addProject(name: string, config: ProjectConfiguration): void {
    projectGraph.nodes[name] = { name, type: 'app', data: config };
  }

  beforeEach(() => {
    projectGraph = { nodes: {}, dependencies: {} };
    jest
      .spyOn(devkit, 'createProjectGraphAsync')
      .mockReturnValue(Promise.resolve(projectGraph));
  });

  test('single project', async () => {
    addProject('test-1', {
      root: 'blah',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'test/jest/config/location/jest.config.js',
          },
        },
      },
    });
    const expectedResults = [
      '<rootDir>/test/jest/config/location/jest.config.js',
    ];
    expect(await getJestProjectsAsync()).toEqual(expectedResults);
  });

  test('custom target name', async () => {
    addProject('test-1', {
      root: 'blah',
      targets: {
        'test-with-jest': {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'test/jest/config/location/jest.config.js',
          },
        },
      },
    });
    const expectedResults = [
      '<rootDir>/test/jest/config/location/jest.config.js',
    ];
    expect(await getJestProjectsAsync()).toEqual(expectedResults);
  });

  test('root project', async () => {
    addProject('test-1', {
      root: '.',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'jest.config.app.js',
          },
        },
      },
    });
    const expectedResults = ['<rootDir>/jest.config.app.js'];
    expect(await getJestProjectsAsync()).toEqual(expectedResults);
  });

  test('configuration set with unique jestConfig', async () => {
    addProject('test-1', {
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
    });
    const expectedResults = [
      '<rootDir>/test/jest/config/location/jest.config.js',
      '<rootDir>/configuration-specific/jest.config.js',
    ];
    expect(await getJestProjectsAsync()).toEqual(expectedResults);
  });

  test('configuration, set with same jestConfig on configuration', async () => {
    addProject('test', {
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
    });
    const expectedResults = [
      '<rootDir>/test/jest/config/location/jest.config.js',
    ];
    expect(await getJestProjectsAsync()).toEqual(expectedResults);
  });

  test('other projects and targets that do not use the nx jest test runner', async () => {
    addProject('otherTarget', {
      root: 'test',
      targets: {
        test: {
          executor: 'something else',
          options: {},
        },
      },
    });
    addProject('test', {
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
    });
    const expectedResults = [];
    expect(await getJestProjectsAsync()).toEqual(expectedResults);
  });

  test.each`
    command
    ${'jest'}
    ${'npx jest'}
    ${'yarn jest'}
    ${'pnpm jest'}
    ${'pnpm dlx jest'}
    ${'echo "foo" && jest'}
    ${'echo "foo" && npx jest'}
    ${'jest && echo "foo"'}
    ${'npx jest && echo "foo"'}
    ${'echo "foo" && jest && echo "bar"'}
    ${'echo "foo" && npx jest && echo "bar"'}
  `(
    'targets with nx:run-commands executor running "$command"',
    async ({ command }) => {
      addProject('test-1', {
        root: 'projects/test-1',
        targets: {
          test: {
            executor: 'nx:run-commands',
            options: { command },
          },
        },
      });
      const expectedResults = ['<rootDir>/projects/test-1'];
      expect(await getJestProjectsAsync()).toEqual(expectedResults);
    }
  );

  test.each`
    command
    ${'jest'}
    ${'npx jest'}
    ${'yarn jest'}
    ${'pnpm jest'}
    ${'pnpm dlx jest'}
    ${'echo "foo" && jest'}
    ${'echo "foo" && npx jest'}
    ${'jest && echo "foo"'}
    ${'npx jest && echo "foo"'}
    ${'echo "foo" && jest && echo "bar"'}
    ${'echo "foo" && npx jest && echo "bar"'}
  `(
    'targets with nx:run-commands executor using "commands" option and running "$command"',
    async ({ command }) => {
      addProject('test-1', {
        root: 'projects/test-1',
        targets: {
          test: {
            executor: 'nx:run-commands',
            options: { commands: [command] },
          },
        },
      });
      const expectedResults = ['<rootDir>/projects/test-1'];
      expect(await getJestProjectsAsync()).toEqual(expectedResults);
    }
  );

  test.each`
    command
    ${'jest'}
    ${'npx jest'}
    ${'yarn jest'}
    ${'pnpm jest'}
    ${'pnpm dlx jest'}
    ${'echo "foo" && jest'}
    ${'echo "foo" && npx jest'}
    ${'jest && echo "foo"'}
    ${'npx jest && echo "foo"'}
    ${'echo "foo" && jest && echo "bar"'}
    ${'echo "foo" && npx jest && echo "bar"'}
  `(
    'targets with nx:run-commands executor using "commands" option using the object notation and running "$command"',
    async ({ command }) => {
      addProject('test-1', {
        root: 'projects/test-1',
        targets: {
          test: {
            executor: 'nx:run-commands',
            options: { commands: [{ command }] },
          },
        },
      });
      const expectedResults = ['<rootDir>/projects/test-1'];
      expect(await getJestProjectsAsync()).toEqual(expectedResults);
    }
  );

  test.each`
    command                                                           | cwd
    ${'jest --config projects/test-1/jest.config.ts'}                 | ${'.'}
    ${'npx jest --config projects/test-1/jest.config.ts'}             | ${'.'}
    ${'jest --config jest.config.ts'}                                 | ${undefined}
    ${'npx jest --config jest.config.ts'}                             | ${undefined}
    ${'jest --config jest.config.ts'}                                 | ${'projects/test-1'}
    ${'npx jest --config jest.config.ts'}                             | ${'projects/test-1'}
    ${'echo "foo" && jest --config jest.config.ts'}                   | ${undefined}
    ${'echo "foo" && npx jest --config jest.config.ts'}               | ${undefined}
    ${'jest --config jest.config.ts && echo "foo"'}                   | ${undefined}
    ${'npx jest --config jest.config.ts && echo "foo"'}               | ${undefined}
    ${'echo "foo" && jest --config jest.config.ts && echo "bar"'}     | ${undefined}
    ${'echo "foo" && npx jest --config jest.config.ts && echo "bar"'} | ${undefined}
  `(
    'targets with nx:run-commands executor running "$command" at "$cwd"',
    async ({ command, cwd }) => {
      addProject('test-1', {
        root: 'projects/test-1',
        targets: {
          test: {
            executor: 'nx:run-commands',
            options: { command, cwd },
          },
        },
      });
      const expectedResults = ['<rootDir>/projects/test-1/jest.config.ts'];
      expect(await getJestProjectsAsync()).toEqual(expectedResults);
    }
  );

  test('targets with nx:run-commands executor with a command with multiple "jest" runs', async () => {
    addProject('test-1', {
      root: 'projects/test-1',
      targets: {
        test: {
          executor: 'nx:run-commands',
          options: {
            command: 'jest && jest --config jest1.config.ts',
          },
        },
      },
    });
    const expectedResults = [
      '<rootDir>/projects/test-1',
      '<rootDir>/projects/test-1/jest1.config.ts',
    ];
    expect(await getJestProjectsAsync()).toEqual(expectedResults);
  });

  test('projects with targets using both executors', async () => {
    addProject('test-1', {
      root: 'projects/test-1',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'projects/test-1/jest.config.js',
          },
        },
      },
    });
    addProject('test-2', {
      root: 'projects/test-2',
      targets: {
        test: {
          executor: 'nx:run-commands',
          options: { command: 'jest' },
        },
      },
    });
    const expectedResults = [
      '<rootDir>/projects/test-1/jest.config.js',
      '<rootDir>/projects/test-2',
    ];
    expect(await getJestProjectsAsync()).toEqual(expectedResults);
  });
});
