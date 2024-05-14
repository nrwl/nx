import { CreateNodesContextV2 } from '@nx/devkit';
import { minimatch } from 'minimatch';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { createNodesV2 } from './plugin';
import { mkdirSync, rmdirSync } from 'fs';

jest.mock('nx/src/utils/cache-directory', () => ({
  ...jest.requireActual('nx/src/utils/cache-directory'),
  workspaceDataDirectory: 'tmp/project-graph-cache',
}));

describe('@nx/eslint/plugin', () => {
  let context: CreateNodesContextV2;
  let tempFs: TempFs;
  let configFiles: string[] = [];

  beforeEach(async () => {
    mkdirSync('tmp/project-graph-cache', { recursive: true });
    tempFs = new TempFs('eslint-plugin');
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
      workspaceRoot: tempFs.tempDir,
    };
  });

  afterEach(() => {
    jest.resetModules();
    tempFs.cleanup();
    tempFs = null;
    rmdirSync('tmp/project-graph-cache', { recursive: true });
  });

  it('should not create any nodes when there are no eslint configs', async () => {
    createFiles({
      'package.json': `{}`,
      'project.json': `{}`,
    });
    expect(await invokeCreateNodesOnMatchingFiles(context, 'lint'))
      .toMatchInlineSnapshot(`
      {
        "projects": {},
      }
    `);
  });

  describe('root eslint config only', () => {
    it('should not create any nodes for just a package.json and root level eslint config', async () => {
      createFiles({
        '.eslintrc.json': `{}`,
        'package.json': `{}`,
      });
      expect(await invokeCreateNodesOnMatchingFiles(context, 'lint'))
        .toMatchInlineSnapshot(`
        {
          "projects": {},
        }
      `);
    });

    // TODO(leo): dynamic import of the flat config fails with jest:
    // "TypeError: A dynamic import callback was invoked without --experimental-vm-modules"
    // mocking the "eslint.config.js" file import is not working, figure out if there's a way
    it.skip('should not create a node for a root level eslint config when accompanied by a project.json, if no src directory is present', async () => {
      createFiles({
        'eslint.config.js': `module.exports = {};`,
        'project.json': `{}`,
      });
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
      createFiles({
        '.eslintrc.json': `{}`,
        'package.json': `{}`,
        'src/index.ts': `console.log('hello world')`,
      });
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
                  "outputs": [
                    "{options.outputFile}",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should create a node for just a package.json and root level eslint config if accompanied by a lib directory', async () => {
      createFiles({
        '.eslintrc.json': `{}`,
        'package.json': `{}`,
        'lib/index.ts': `console.log('hello world')`,
      });
      // NOTE: The command is specifically targeting the src directory in the case of a standalone Nx workspace
      expect(await invokeCreateNodesOnMatchingFiles(context, 'lint'))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            ".": {
              "targets": {
                "lint": {
                  "cache": true,
                  "command": "eslint ./lib",
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
                  "outputs": [
                    "{options.outputFile}",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should not create a node for just a package.json and root level eslint config if accompanied by a src directory when all files are ignored (.eslintignore)', async () => {
      createFiles({
        '.eslintrc.json': `{}`,
        '.eslintignore': `**/*`,
        'package.json': `{}`,
        'src/index.ts': `console.log('hello world')`,
      });
      // NOTE: The command is specifically targeting the src directory in the case of a standalone Nx workspace
      expect(await invokeCreateNodesOnMatchingFiles(context, 'lint'))
        .toMatchInlineSnapshot(`
        {
          "projects": {},
        }
      `);
    });

    it('should not create a node for just a package.json and root level eslint config if accompanied by a src directory when all files are ignored (ignorePatterns in .eslintrc.json)', async () => {
      createFiles({
        '.eslintrc.json': `{ "ignorePatterns": ["**/*"] }`,
        'package.json': `{}`,
        'src/index.ts': `console.log('hello world')`,
      });
      // NOTE: The command is specifically targeting the src directory in the case of a standalone Nx workspace
      expect(await invokeCreateNodesOnMatchingFiles(context, 'lint'))
        .toMatchInlineSnapshot(`
        {
          "projects": {},
        }
      `);
    });

    it('should create a node for a nested project (with a project.json and any lintable file) which does not have its own eslint config if accompanied by a root level eslint config', async () => {
      createFiles({
        '.eslintrc.json': `{}`,
        'apps/my-app/project.json': `{}`,
        // This file is lintable so create the target
        'apps/my-app/index.ts': `console.log('hello world')`,
      });
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
                  "outputs": [
                    "{options.outputFile}",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should create a node for a nested project (with a package.json and any lintable file) which does not have its own eslint config if accompanied by a root level eslint config', async () => {
      createFiles({
        '.eslintrc.json': `{}`,
        'apps/my-app/package.json': `{}`,
        // This file is lintable so create the target
        'apps/my-app/index.ts': `console.log('hello world')`,
      });
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
                  "outputs": [
                    "{options.outputFile}",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should not create a node for a nested project (with a package.json and no lintable files) which does not have its own eslint config if accompanied by a root level eslint config', async () => {
      createFiles({
        '.eslintrc.json': `{}`,
        'apps/my-app/package.json': `{}`,
        // These files are not lintable so do not create the target
        'apps/my-app/one.png': `...`,
        'apps/my-app/two.mov': `...`,
        'apps/my-app/three.css': `...`,
        'apps/my-app/config-one.yaml': `...`,
        'apps/my-app/config-two.yml': `...`,
      });
      expect(await invokeCreateNodesOnMatchingFiles(context, 'lint'))
        .toMatchInlineSnapshot(`
        {
          "projects": {},
        }
      `);
    });

    it('should not create a node for a nested project (with a project.json and no lintable files) which does not have its own eslint config if accompanied by a root level eslint config', async () => {
      createFiles({
        '.eslintrc.json': `{}`,
        'apps/my-app/project.json': `{}`,
        // These files are not lintable so do not create the target
        'apps/my-app/one.png': `...`,
        'apps/my-app/two.mov': `...`,
        'apps/my-app/three.css': `...`,
        'apps/my-app/config-one.yaml': `...`,
        'apps/my-app/config-two.yml': `...`,
      });
      expect(await invokeCreateNodesOnMatchingFiles(context, 'lint'))
        .toMatchInlineSnapshot(`
        {
          "projects": {},
        }
      `);
    });

    it('should not create a node for a nested project (with a project.json and all files ignored) which does not have its own eslint config if accompanied by a root level eslint config', async () => {
      createFiles({
        '.eslintrc.json': `{ "ignorePatterns": ["**/*"] }`,
        'apps/my-app/project.json': `{}`,
        // This file is lintable so create the target
        'apps/my-app/index.ts': `console.log('hello world')`,
      });
      expect(await invokeCreateNodesOnMatchingFiles(context, 'lint'))
        .toMatchInlineSnapshot(`
        {
          "projects": {},
        }
      `);
    });

    it('should not create a node for a nested project (with a package.json and all files ignored) which does not have its own eslint config if accompanied by a root level eslint config', async () => {
      createFiles({
        '.eslintrc.json': `{ "ignorePatterns": ["**/*"] }`,
        'apps/my-app/package.json': `{}`,
        // This file is lintable so create the target
        'apps/my-app/index.ts': `console.log('hello world')`,
      });
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
      createFiles({
        'apps/my-app/.eslintrc.json': `{}`,
        'apps/my-app/project.json': `{}`,
        'apps/my-app/index.ts': `console.log('hello world')`,
        'libs/my-lib/.eslintrc.json': `{}`,
        'libs/my-lib/project.json': `{}`,
        'libs/my-lib/index.ts': `console.log('hello world')`,
      });
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
                  "outputs": [
                    "{options.outputFile}",
                  ],
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
                  "outputs": [
                    "{options.outputFile}",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should not create nodes for nested projects without a root level eslint config when all files are ignored (.eslintignore)', async () => {
      createFiles({
        'apps/my-app/.eslintrc.json': `{}`,
        'apps/my-app/.eslintignore': `**/*`,
        'apps/my-app/project.json': `{}`,
        'apps/my-app/index.ts': `console.log('hello world')`,
        'libs/my-lib/.eslintrc.json': `{}`,
        'libs/my-lib/.eslintignore': `**/*`,
        'libs/my-lib/project.json': `{}`,
        'libs/my-lib/index.ts': `console.log('hello world')`,
      });
      expect(await invokeCreateNodesOnMatchingFiles(context, 'lint'))
        .toMatchInlineSnapshot(`
        {
          "projects": {},
        }
      `);
    });

    it('should not create nodes for nested projects without a root level eslint config when all files are ignored (ignorePatterns in .eslintrc.json)', async () => {
      createFiles({
        'apps/my-app/.eslintrc.json': `{ "ignorePatterns": ["**/*"] }`,
        'apps/my-app/project.json': `{}`,
        'apps/my-app/index.ts': `console.log('hello world')`,
        'libs/my-lib/.eslintrc.json': `{ "ignorePatterns": ["**/*"] }`,
        'libs/my-lib/project.json': `{}`,
        'libs/my-lib/index.ts': `console.log('hello world')`,
      });
      expect(await invokeCreateNodesOnMatchingFiles(context, 'lint'))
        .toMatchInlineSnapshot(`
        {
          "projects": {},
        }
      `);
    });
  });

  describe('root eslint config and nested eslint configs', () => {
    it('should create appropriate nodes for just a package.json and root level eslint config combined with nested eslint configs', async () => {
      createFiles({
        '.eslintrc.json': `{}`,
        'package.json': `{}`,
        'apps/my-app/.eslintrc.json': `{}`,
        'apps/my-app/project.json': `{}`,
        'apps/my-app/index.ts': `console.log('hello world')`,
        'libs/my-lib/.eslintrc.json': `{}`,
        'libs/my-lib/project.json': `{}`,
        'libs/my-lib/index.ts': `console.log('hello world')`,
      });
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
                  "outputs": [
                    "{options.outputFile}",
                  ],
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
                  "outputs": [
                    "{options.outputFile}",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should create appropriate nodes for a nested project without its own eslint config but with an orphaned eslint config in its parent hierarchy', async () => {
      createFiles({
        '.eslintrc.json': '{}',
        'apps/.eslintrc.json': '{}',
        'apps/myapp/project.json': '{}',
        'apps/myapp/index.ts': 'console.log("hello world")',
      });
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
                  "outputs": [
                    "{options.outputFile}",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should handle multiple levels of nesting and ignored files correctly', async () => {
      createFiles({
        '.eslintrc.json': '{ "root": true, "ignorePatterns": ["**/*"] }',
        'apps/myapp/.eslintrc.json': '{ "extends": "../../.eslintrc.json" }', // no lintable files, don't create task
        'apps/myapp/project.json': '{}',
        'apps/myapp/index.ts': 'console.log("hello world")',
        'apps/myapp/nested/mylib/.eslintrc.json': JSON.stringify({
          extends: '../../../../.eslintrc.json',
          ignorePatterns: ['!**/*'], // include all files, create task
        }),
        'apps/myapp/nested/mylib/project.json': '{}',
        'apps/myapp/nested/mylib/index.ts': 'console.log("hello world")',
      });
      expect(await invokeCreateNodesOnMatchingFiles(context, 'lint'))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            "apps/myapp/nested/mylib": {
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
                    "cwd": "apps/myapp/nested/mylib",
                  },
                  "outputs": [
                    "{options.outputFile}",
                  ],
                },
              },
            },
          },
        }
      `);
    });
  });

  function createFiles(fileSys: Record<string, string>) {
    tempFs.createFilesSync(fileSys);
    configFiles = getMatchingFiles(Object.keys(fileSys));
  }

  function getMatchingFiles(allConfigFiles: string[]): string[] {
    return allConfigFiles.filter((file) =>
      minimatch(file, createNodesV2[0], { dot: true })
    );
  }

  async function invokeCreateNodesOnMatchingFiles(
    context: CreateNodesContextV2,
    targetName: string
  ) {
    const aggregateProjects: Record<string, any> = {};
    const results = await createNodesV2[1](
      configFiles,
      { targetName },
      context
    );
    for (const [, nodes] of results) {
      Object.assign(aggregateProjects, nodes.projects);
    }
    return {
      projects: aggregateProjects,
    };
  }
});
