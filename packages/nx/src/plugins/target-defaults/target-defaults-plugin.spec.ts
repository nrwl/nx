import * as memfs from 'memfs';

import '../../../src/internal-testing-utils/mock-fs';

import { TargetDefaultsPlugin } from './target-defaults-plugin';
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
                  "options": {
                    "cwd": "{projectRoot}",
                  },
                },
                "echo2": {
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
});
