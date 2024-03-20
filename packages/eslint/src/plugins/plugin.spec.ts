import 'nx/src/internal-testing-utils/mock-fs';

jest.mock(
  'nx/src/utils/workspace-context',
  (): Partial<typeof import('nx/src/utils/workspace-context')> => {
    const glob = require('fast-glob');
    return {
      globWithWorkspaceContext(workspaceRoot: string, patterns: string[]) {
        // This glob will operate on memfs thanks to 'nx/src/internal-testing-utils/mock-fs'
        return glob.sync(patterns, { cwd: workspaceRoot });
      },
    };
  }
);

import { CreateNodesContext } from '@nx/devkit';
import { vol } from 'memfs';
import { minimatch } from 'minimatch';
import { createNodes } from './plugin';

describe('@nx/eslint/plugin', () => {
  let context: CreateNodesContext;

  beforeEach(async () => {
    context = {
      nxJsonConfiguration: {
        // These defaults should be overridden by the plugin
        targetDefaults: {
          lint: {
            cache: false,
            inputs: ['foo', '^foo'],
          },
        },
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['!{projectRoot}/**/*.spec.ts'],
        },
      },
      workspaceRoot: '',
      configFiles: [],
    };
  });

  afterEach(() => {
    vol.reset();
    jest.resetModules();
  });

  it('should not create any nodes when there are no eslint configs', async () => {
    applyFilesToVolAndContext(
      {
        'package.json': `{}`,
        'project.json': `{}`,
      },
      context
    );
    expect(await invokeCreateNodesOnMatchingFiles(context, 'lint'))
      .toMatchInlineSnapshot(`
      {
        "projects": {},
      }
    `);
  });

  describe('root eslint config only', () => {
    it('should not create any nodes for just a package.json and root level eslint config', async () => {
      applyFilesToVolAndContext(
        {
          '.eslintrc.json': `{}`,
          'package.json': `{}`,
        },
        context
      );
      expect(await invokeCreateNodesOnMatchingFiles(context, 'lint'))
        .toMatchInlineSnapshot(`
        {
          "projects": {},
        }
      `);
    });

    it('should not create a node for a root level eslint config when accompanied by a project.json, if no src directory is present', async () => {
      applyFilesToVolAndContext(
        {
          'eslint.config.js': `module.exports = {};`,
          'project.json': `{}`,
        },
        context
      );
      // NOTE: It should set ESLINT_USE_FLAT_CONFIG to true because of the use of eslint.config.js
      expect(await invokeCreateNodesOnMatchingFiles(context, 'lint'))
        .toMatchInlineSnapshot(`
        {
          "projects": {},
        }
      `);
    });

    // Standalone Nx workspace style setup
    it('should create a node for just a package.json and root level eslint config if accompanied by a src directory', async () => {
      applyFilesToVolAndContext(
        {
          '.eslintrc.json': `{}`,
          'package.json': `{}`,
          'src/index.ts': `console.log('hello world')`,
        },
        context
      );
      // NOTE: The command is specifically targeting the src directory in the case of a standalone Nx workspace
      expect(await invokeCreateNodesOnMatchingFiles(context, 'lint'))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            ".": {
              "targets": {
                "lint": {
                  "cache": true,
                  "command": "eslint ./src",
                  "inputs": [
                    "default",
                    "^default",
                    "{projectRoot}/eslintrc.json",
                    "{workspaceRoot}/tools/eslint-rules/**/*",
                    {
                      "externalDependencies": [
                        "eslint",
                      ],
                    },
                  ],
                  "options": {
                    "cwd": ".",
                  },
                },
              },
            },
          },
        }
      `);
    });

    it('should create a node for a nested project (with a project.json and any lintable file) which does not have its own eslint config if accompanied by a root level eslint config', async () => {
      applyFilesToVolAndContext(
        {
          '.eslintrc.json': `{}`,
          'apps/my-app/project.json': `{}`,
          // This file is lintable so create the target
          'apps/my-app/index.ts': `console.log('hello world')`,
        },
        context
      );
      expect(await invokeCreateNodesOnMatchingFiles(context, 'lint'))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            "apps/my-app": {
              "targets": {
                "lint": {
                  "cache": true,
                  "command": "eslint .",
                  "inputs": [
                    "default",
                    "^default",
                    "{workspaceRoot}/.eslintrc.json",
                    "{workspaceRoot}/tools/eslint-rules/**/*",
                    {
                      "externalDependencies": [
                        "eslint",
                      ],
                    },
                  ],
                  "options": {
                    "cwd": "apps/my-app",
                  },
                },
              },
            },
          },
        }
      `);
    });

    it('should create a node for a nested project (with a package.json and any lintable file) which does not have its own eslint config if accompanied by a root level eslint config', async () => {
      applyFilesToVolAndContext(
        {
          '.eslintrc.json': `{}`,
          'apps/my-app/package.json': `{}`,
          // This file is lintable so create the target
          'apps/my-app/index.ts': `console.log('hello world')`,
        },
        context
      );
      expect(await invokeCreateNodesOnMatchingFiles(context, 'lint'))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            "apps/my-app": {
              "targets": {
                "lint": {
                  "cache": true,
                  "command": "eslint .",
                  "inputs": [
                    "default",
                    "^default",
                    "{workspaceRoot}/.eslintrc.json",
                    "{workspaceRoot}/tools/eslint-rules/**/*",
                    {
                      "externalDependencies": [
                        "eslint",
                      ],
                    },
                  ],
                  "options": {
                    "cwd": "apps/my-app",
                  },
                },
              },
            },
          },
        }
      `);
    });

    it('should not create a node for a nested project (with a package.json and no lintable files) which does not have its own eslint config if accompanied by a root level eslint config', async () => {
      applyFilesToVolAndContext(
        {
          '.eslintrc.json': `{}`,
          'apps/my-app/package.json': `{}`,
          // These files are not lintable so do not create the target
          'apps/my-app/one.png': `...`,
          'apps/my-app/two.mov': `...`,
          'apps/my-app/three.css': `...`,
          'apps/my-app/config-one.yaml': `...`,
          'apps/my-app/config-two.yml': `...`,
        },
        context
      );
      expect(await invokeCreateNodesOnMatchingFiles(context, 'lint'))
        .toMatchInlineSnapshot(`
        {
          "projects": {},
        }
      `);
    });

    it('should not create a node for a nested project (with a project.json and no lintable files) which does not have its own eslint config if accompanied by a root level eslint config', async () => {
      applyFilesToVolAndContext(
        {
          '.eslintrc.json': `{}`,
          'apps/my-app/project.json': `{}`,
          // These files are not lintable so do not create the target
          'apps/my-app/one.png': `...`,
          'apps/my-app/two.mov': `...`,
          'apps/my-app/three.css': `...`,
          'apps/my-app/config-one.yaml': `...`,
          'apps/my-app/config-two.yml': `...`,
        },
        context
      );
      expect(await invokeCreateNodesOnMatchingFiles(context, 'lint'))
        .toMatchInlineSnapshot(`
        {
          "projects": {},
        }
      `);
    });
  });

  describe('nested eslint configs only', () => {
    it('should create appropriate nodes for nested projects without a root level eslint config', async () => {
      applyFilesToVolAndContext(
        {
          'apps/my-app/.eslintrc.json': `{}`,
          'apps/my-app/project.json': `{}`,
          'apps/my-app/index.ts': `console.log('hello world')`,
          'libs/my-lib/.eslintrc.json': `{}`,
          'libs/my-lib/project.json': `{}`,
          'libs/my-lib/index.ts': `console.log('hello world')`,
        },
        context
      );
      expect(await invokeCreateNodesOnMatchingFiles(context, 'lint'))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            "apps/my-app": {
              "targets": {
                "lint": {
                  "cache": true,
                  "command": "eslint .",
                  "inputs": [
                    "default",
                    "^default",
                    "{projectRoot}/.eslintrc.json",
                    "{workspaceRoot}/tools/eslint-rules/**/*",
                    {
                      "externalDependencies": [
                        "eslint",
                      ],
                    },
                  ],
                  "options": {
                    "cwd": "apps/my-app",
                  },
                },
              },
            },
            "libs/my-lib": {
              "targets": {
                "lint": {
                  "cache": true,
                  "command": "eslint .",
                  "inputs": [
                    "default",
                    "^default",
                    "{projectRoot}/.eslintrc.json",
                    "{workspaceRoot}/tools/eslint-rules/**/*",
                    {
                      "externalDependencies": [
                        "eslint",
                      ],
                    },
                  ],
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                },
              },
            },
          },
        }
      `);
    });
  });

  describe('root eslint config and nested eslint configs', () => {
    it('should create appropriate nodes for just a package.json and root level eslint config combined with nested eslint configs', async () => {
      applyFilesToVolAndContext(
        {
          '.eslintrc.json': `{}`,
          'package.json': `{}`,
          'apps/my-app/.eslintrc.json': `{}`,
          'apps/my-app/project.json': `{}`,
          'apps/my-app/index.ts': `console.log('hello world')`,
          'libs/my-lib/.eslintrc.json': `{}`,
          'libs/my-lib/project.json': `{}`,
          'libs/my-lib/index.ts': `console.log('hello world')`,
        },
        context
      );
      // NOTE: The nested projects have the root level config as an input to their lint targets
      expect(await invokeCreateNodesOnMatchingFiles(context, 'lint'))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            "apps/my-app": {
              "targets": {
                "lint": {
                  "cache": true,
                  "command": "eslint .",
                  "inputs": [
                    "default",
                    "^default",
                    "{workspaceRoot}/.eslintrc.json",
                    "{projectRoot}/.eslintrc.json",
                    "{workspaceRoot}/tools/eslint-rules/**/*",
                    {
                      "externalDependencies": [
                        "eslint",
                      ],
                    },
                  ],
                  "options": {
                    "cwd": "apps/my-app",
                  },
                },
              },
            },
            "libs/my-lib": {
              "targets": {
                "lint": {
                  "cache": true,
                  "command": "eslint .",
                  "inputs": [
                    "default",
                    "^default",
                    "{workspaceRoot}/.eslintrc.json",
                    "{projectRoot}/.eslintrc.json",
                    "{workspaceRoot}/tools/eslint-rules/**/*",
                    {
                      "externalDependencies": [
                        "eslint",
                      ],
                    },
                  ],
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                },
              },
            },
          },
        }
      `);
    });

    it('should create appropriate nodes for a nested project without its own eslint config but with an orphaned eslint config in its parent hierarchy', async () => {
      applyFilesToVolAndContext(
        {
          '.eslintrc.json': '{}',
          'apps/.eslintrc.json': '{}',
          'apps/myapp/project.json': '{}',
          'apps/myapp/index.ts': 'console.log("hello world")',
        },
        context
      );
      // NOTE: The nested projects have the root level config as an input to their lint targets
      expect(await invokeCreateNodesOnMatchingFiles(context, 'lint'))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            "apps/myapp": {
              "targets": {
                "lint": {
                  "cache": true,
                  "command": "eslint .",
                  "inputs": [
                    "default",
                    "^default",
                    "{workspaceRoot}/.eslintrc.json",
                    "{workspaceRoot}/apps/.eslintrc.json",
                    "{workspaceRoot}/tools/eslint-rules/**/*",
                    {
                      "externalDependencies": [
                        "eslint",
                      ],
                    },
                  ],
                  "options": {
                    "cwd": "apps/myapp",
                  },
                },
              },
            },
          },
        }
      `);
    });
  });
});

function getMatchingFiles(allConfigFiles: string[]): string[] {
  return allConfigFiles.filter((file) =>
    minimatch(file, createNodes[0], { dot: true })
  );
}

function applyFilesToVolAndContext(
  fileSys: Record<string, string>,
  context: CreateNodesContext
) {
  vol.fromJSON(fileSys, '');
  // @ts-expect-error update otherwise readonly property for testing
  context.configFiles = getMatchingFiles(Object.keys(fileSys));
}

async function invokeCreateNodesOnMatchingFiles(
  context: CreateNodesContext,
  targetName: string
) {
  const aggregateProjects: Record<string, any> = {};
  for (const file of context.configFiles) {
    const nodes = await createNodes[1](file, { targetName }, context);
    Object.assign(aggregateProjects, nodes.projects);
  }
  return {
    projects: aggregateProjects,
  };
}
