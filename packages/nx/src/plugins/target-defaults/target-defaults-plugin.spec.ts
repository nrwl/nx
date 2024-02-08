import * as memfs from 'memfs';

import '../../../src/internal-testing-utils/mock-fs';

import { getTargetInfo, TargetDefaultsPlugin } from './target-defaults-plugin';
import { CreateNodesContext } from '../../utils/nx-plugin';
const {
  createNodes: [, createNodesFn],
} = TargetDefaultsPlugin;

describe('target-defaults plugin', () => {
  let context: CreateNodesContext;
  beforeEach(() => {
    context = {
      nxJsonConfiguration: {
        targetDefaults: {
          build: {
            dependsOn: ['^build'],
          },
        },
      },
      workspaceRoot: '/root',
    };
  });

  afterEach(() => {
    memfs.vol.reset();
  });

  it('should add target default info to project json projects', () => {
    memfs.vol.fromJSON(
      {
        'project.json': JSON.stringify({
          name: 'root',
          targets: { echo: { command: 'echo root project' } },
        }),
        'packages/lib-a/project.json': JSON.stringify({
          name: 'lib-a',
          targets: {
            build: {
              executor: 'nx:run-commands',
              options: {},
            },
          },
        }),
      },
      '/root'
    );

    expect(createNodesFn('project.json', undefined, context))
      .toMatchInlineSnapshot(`
      {
        "projects": {
          ".": {
            "targets": {
              "build": {
                "dependsOn": [
                  "^build",
                ],
                Symbol(ONLY_MODIFIES_EXISTING_TARGET): true,
              },
            },
          },
        },
      }
    `);
    expect(createNodesFn('packages/lib-a/project.json', undefined, context))
      .toMatchInlineSnapshot(`
      {
        "projects": {
          "packages/lib-a": {
            "targets": {
              "build": {
                "dependsOn": [
                  "^build",
                ],
                "executor": "nx:run-commands",
              },
            },
          },
        },
      }
    `);
  });

  it('should add target if package.json has nx but no includedScripts', () => {
    memfs.vol.fromJSON(
      {
        'package.json': JSON.stringify({
          name: 'lib-a',
          scripts: {
            test: 'nx affected:test',
          },
          nx: {},
        }),
      },
      '/root'
    );

    expect(
      createNodesFn('package.json', undefined, {
        nxJsonConfiguration: {
          targetDefaults: {
            test: {
              command: 'jest',
            },
          },
        },
        workspaceRoot: '/root',
      })
    ).toMatchInlineSnapshot(`
      {
        "projects": {
          ".": {
            "targets": {
              "test": {
                "command": "jest",
                "executor": "nx:run-script",
                "options": {
                  "script": "test",
                },
              },
            },
          },
        },
      }
    `);
  });

  it('should add target if package.json has nx and includes the script in includedScripts', () => {
    memfs.vol.fromJSON(
      {
        'package.json': JSON.stringify({
          name: 'lib-a',
          scripts: {
            test: 'nx affected:test',
          },
          nx: {
            includedScripts: ['test'],
          },
        }),
      },
      '/root'
    );

    expect(
      createNodesFn('package.json', undefined, {
        nxJsonConfiguration: {
          targetDefaults: {
            test: {
              command: 'jest',
            },
          },
        },
        workspaceRoot: '/root',
      })
    ).toMatchInlineSnapshot(`
      {
        "projects": {
          ".": {
            "targets": {
              "test": {
                "command": "jest",
                "executor": "nx:run-script",
                "options": {
                  "script": "test",
                },
              },
            },
          },
        },
      }
    `);
  });

  it('should not add target if package.json does not have nx', () => {
    memfs.vol.fromJSON(
      {
        'package.json': JSON.stringify({
          name: 'lib-a',
          scripts: {
            test: 'nx affected:test',
          },
        }),
      },
      '/root'
    );

    expect(
      createNodesFn('package.json', undefined, {
        nxJsonConfiguration: {
          targetDefaults: {
            test: {
              command: 'jest',
            },
          },
        },
        workspaceRoot: '/root',
      })
    ).toMatchInlineSnapshot(`{}`);
  });

  it('should not add target if project does not define target', () => {
    memfs.vol.fromJSON(
      {
        'package.json': JSON.stringify({
          name: 'lib-a',
          scripts: {
            test: 'nx affected:test',
          },
          nx: {
            includedScripts: [],
          },
        }),
      },
      '/root'
    );

    expect(
      createNodesFn('package.json', undefined, {
        nxJsonConfiguration: {
          targetDefaults: {
            test: {
              command: 'jest',
            },
          },
        },
        workspaceRoot: '/root',
      })
    ).toMatchInlineSnapshot(`
      {
        "projects": {
          ".": {
            "targets": {
              "test": {
                "command": "jest",
                "executor": "nx:run-script",
                "options": {
                  "script": "test",
                },
                Symbol(ONLY_MODIFIES_EXISTING_TARGET): true,
              },
            },
          },
        },
      }
    `);
  });

  describe('executor key', () => {
    it('should support multiple targets with the same executor', () => {
      memfs.vol.fromJSON(
        {
          'project.json': JSON.stringify({
            name: 'root',
            targets: {
              echo: {
                executor: 'nx:run-commands',
                options: {
                  command: 'echo 1',
                },
              },
              echo2: {
                executor: 'nx:run-commands',
                options: {
                  command: 'echo 2',
                },
              },
            },
          }),
        },
        '/root'
      );

      context.nxJsonConfiguration.targetDefaults = {
        'nx:run-commands': {
          options: {
            cwd: '{projectRoot}',
          },
        },
      };

      expect(createNodesFn('project.json', undefined, context))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            ".": {
              "targets": {
                "echo": {
                  "executor": "nx:run-commands",
                  "options": {
                    "cwd": "{projectRoot}",
                  },
                },
                "echo2": {
                  "executor": "nx:run-commands",
                  "options": {
                    "cwd": "{projectRoot}",
                  },
                },
                "nx:run-commands": {
                  "options": {
                    "cwd": "{projectRoot}",
                  },
                  Symbol(ONLY_MODIFIES_EXISTING_TARGET): true,
                },
              },
            },
          },
        }
      `);
    });

    it('should not be overridden by target name based default', () => {
      memfs.vol.fromJSON(
        {
          'project.json': JSON.stringify({
            name: 'root',
            targets: {
              echo: {
                executor: 'nx:run-commands',
                options: {
                  command: 'echo 1',
                },
              },
              echo2: {
                executor: 'nx:run-commands',
                options: {
                  command: 'echo 2',
                },
              },
            },
          }),
        },
        '/root'
      );

      context.nxJsonConfiguration.targetDefaults = {
        'nx:run-commands': {
          options: {
            cwd: '{projectRoot}',
          },
        },
        echo: {},
      };

      expect(createNodesFn('project.json', undefined, context))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            ".": {
              "targets": {
                "echo": {
                  "executor": "nx:run-commands",
                  "options": {
                    "cwd": "{projectRoot}",
                  },
                },
                "echo2": {
                  "executor": "nx:run-commands",
                  "options": {
                    "cwd": "{projectRoot}",
                  },
                },
                "nx:run-commands": {
                  "options": {
                    "cwd": "{projectRoot}",
                  },
                  Symbol(ONLY_MODIFIES_EXISTING_TARGET): true,
                },
              },
            },
          },
        }
      `);
    });
  });

  describe('get target info', () => {
    it('should include command for single command', () => {
      const result = getTargetInfo(
        'echo',
        {
          targets: {
            echo: {
              command: 'echo hi',
            },
          },
        },
        null
      );
      expect(result).toMatchInlineSnapshot(`
        {
          "command": "echo hi",
        }
      `);
    });

    it('should include command for run-commands', () => {
      const result = getTargetInfo(
        'echo',
        {
          targets: {
            echo: {
              executor: 'nx:run-commands',
              options: {
                command: 'echo hi',
                cwd: '{projectRoot}',
              },
            },
          },
        },
        null
      );
      expect(result).toMatchInlineSnapshot(`
        {
          "executor": "nx:run-commands",
          "options": {
            "command": "echo hi",
          },
        }
      `);
    });

    it('should include script for run-script', () => {
      expect(
        getTargetInfo('build', null, {
          scripts: {
            build: 'echo hi',
          },
        })
      ).toMatchInlineSnapshot(`
        {
          "executor": "nx:run-script",
          "options": {
            "script": "build",
          },
        }
      `);

      expect(
        getTargetInfo('echo', null, {
          scripts: {
            build: 'echo hi',
          },
          nx: {
            targets: {
              echo: {
                executor: 'nx:run-script',
                options: {
                  script: 'build',
                },
              },
            },
          },
        })
      ).toMatchInlineSnapshot(`
        {
          "executor": "nx:run-script",
          "options": {
            "script": "build",
          },
        }
      `);
    });
  });
});
