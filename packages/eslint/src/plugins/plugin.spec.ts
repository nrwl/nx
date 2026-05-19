import { CreateNodesContextV2 } from '@nx/devkit';
import { minimatch } from 'minimatch';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { createNodesV2, EslintPluginOptions } from './plugin';
import { mkdirSync, rmSync } from 'fs';

jest.mock('nx/src/utils/cache-directory', () => ({
  ...jest.requireActual('nx/src/utils/cache-directory'),
  workspaceDataDirectory: 'tmp/project-graph-cache',
}));

const resolveESLintClassSpy = jest.fn();
jest.mock('../utils/resolve-eslint-class', () => ({
  resolveESLintClass: (...args) => {
    resolveESLintClassSpy(...args);
    return jest
      .requireActual('../utils/resolve-eslint-class')
      .resolveESLintClass(...args);
  },
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
    tempFs.createFileSync('package-lock.json', '{}');
  });

  afterEach(() => {
    jest.resetModules();
    resolveESLintClassSpy.mockClear();
    tempFs.cleanup();
    tempFs = null;
    rmSync('tmp/project-graph-cache', { recursive: true, force: true });
  });

  it('should not create any nodes when there are no eslint configs', async () => {
    createFiles({
      'package.json': `{}`,
      'project.json': `{}`,
    });
    expect(
      await invokeCreateNodesOnMatchingFiles(context, { targetName: 'lint' })
    ).toMatchInlineSnapshot(`
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
      expect(
        await invokeCreateNodesOnMatchingFiles(context, { targetName: 'lint' })
      ).toMatchInlineSnapshot(`
        {
          "projects": {},
        }
      `);
    });

    // TODO(leo): dynamic import of the flat config fails with jest:
    // "TypeError: A dynamic import callback was invoked without --experimental-vm-modules"
    // mocking the "eslint.config.cjs" file import is not working, figure out if there's a way
    it.skip('should not create a node for a root level eslint config when accompanied by a project.json, if no src directory is present', async () => {
      createFiles({
        'eslint.config.cjs': `module.exports = {};`,
        'project.json': `{}`,
      });
      // NOTE: It should set ESLINT_USE_FLAT_CONFIG to true because of the use of eslint.config.cjs
      expect(
        await invokeCreateNodesOnMatchingFiles(context, { targetName: 'lint' })
      ).toMatchInlineSnapshot(`
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
      expect(
        await invokeCreateNodesOnMatchingFiles(context, { targetName: 'lint' })
      ).toMatchInlineSnapshot(`
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
                    "{workspaceRoot}/.eslintrc.json",
                    "{workspaceRoot}/tools/eslint-rules/**/*",
                    {
                      "externalDependencies": [
                        "eslint",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Runs ESLint on project",
                    "help": {
                      "command": "npx eslint --help",
                      "example": {
                        "options": {
                          "max-warnings": 0,
                        },
                      },
                    },
                    "technologies": [
                      "eslint",
                    ],
                  },
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
      expect(
        await invokeCreateNodesOnMatchingFiles(context, { targetName: 'lint' })
      ).toMatchInlineSnapshot(`
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
                    "{workspaceRoot}/.eslintrc.json",
                    "{workspaceRoot}/tools/eslint-rules/**/*",
                    {
                      "externalDependencies": [
                        "eslint",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Runs ESLint on project",
                    "help": {
                      "command": "npx eslint --help",
                      "example": {
                        "options": {
                          "max-warnings": 0,
                        },
                      },
                    },
                    "technologies": [
                      "eslint",
                    ],
                  },
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
      expect(
        await invokeCreateNodesOnMatchingFiles(context, { targetName: 'lint' })
      ).toMatchInlineSnapshot(`
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
      expect(
        await invokeCreateNodesOnMatchingFiles(context, { targetName: 'lint' })
      ).toMatchInlineSnapshot(`
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
      expect(
        await invokeCreateNodesOnMatchingFiles(context, { targetName: 'lint' })
      ).toMatchInlineSnapshot(`
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
                  "metadata": {
                    "description": "Runs ESLint on project",
                    "help": {
                      "command": "npx eslint --help",
                      "example": {
                        "options": {
                          "max-warnings": 0,
                        },
                      },
                    },
                    "technologies": [
                      "eslint",
                    ],
                  },
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
      expect(
        await invokeCreateNodesOnMatchingFiles(context, { targetName: 'lint' })
      ).toMatchInlineSnapshot(`
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
                  "metadata": {
                    "description": "Runs ESLint on project",
                    "help": {
                      "command": "npx eslint --help",
                      "example": {
                        "options": {
                          "max-warnings": 0,
                        },
                      },
                    },
                    "technologies": [
                      "eslint",
                    ],
                  },
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
      expect(
        await invokeCreateNodesOnMatchingFiles(context, { targetName: 'lint' })
      ).toMatchInlineSnapshot(`
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
      expect(
        await invokeCreateNodesOnMatchingFiles(context, { targetName: 'lint' })
      ).toMatchInlineSnapshot(`
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
      expect(
        await invokeCreateNodesOnMatchingFiles(context, { targetName: 'lint' })
      ).toMatchInlineSnapshot(`
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
      expect(
        await invokeCreateNodesOnMatchingFiles(context, { targetName: 'lint' })
      ).toMatchInlineSnapshot(`
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
      expect(
        await invokeCreateNodesOnMatchingFiles(context, { targetName: 'lint' })
      ).toMatchInlineSnapshot(`
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
                    "{workspaceRoot}/apps/my-app/.eslintrc.json",
                    "{workspaceRoot}/tools/eslint-rules/**/*",
                    {
                      "externalDependencies": [
                        "eslint",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Runs ESLint on project",
                    "help": {
                      "command": "npx eslint --help",
                      "example": {
                        "options": {
                          "max-warnings": 0,
                        },
                      },
                    },
                    "technologies": [
                      "eslint",
                    ],
                  },
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
                    "{workspaceRoot}/libs/my-lib/.eslintrc.json",
                    "{workspaceRoot}/tools/eslint-rules/**/*",
                    {
                      "externalDependencies": [
                        "eslint",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Runs ESLint on project",
                    "help": {
                      "command": "npx eslint --help",
                      "example": {
                        "options": {
                          "max-warnings": 0,
                        },
                      },
                    },
                    "technologies": [
                      "eslint",
                    ],
                  },
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

    // This is intentionally disabled, since we should always create a node for project that contains eslint config
    // it('should not create nodes for nested projects without a root level eslint config when all files are ignored (.eslintignore)', async () => {
    //   createFiles({
    //     'apps/my-app/.eslintrc.json': `{}`,
    //     'apps/my-app/.eslintignore': `**/*`,
    //     'apps/my-app/project.json': `{}`,
    //     'apps/my-app/index.ts': `console.log('hello world')`,
    //     'libs/my-lib/.eslintrc.json': `{}`,
    //     'libs/my-lib/.eslintignore': `**/*`,
    //     'libs/my-lib/project.json': `{}`,
    //     'libs/my-lib/index.ts': `console.log('hello world')`,
    //   });
    //   expect(
    //     await invokeCreateNodesOnMatchingFiles(context, { targetName: 'lint' })
    //   ).toMatchInlineSnapshot(`
    //     {
    //       "projects": {},
    //     }
    //   `);
    // });

    // This is intentionally disabled, since we should always create a node for project that contains eslint config
    // it('should not create nodes for nested projects without a root level eslint config when all files are ignored (ignorePatterns in .eslintrc.json)', async () => {
    //   createFiles({
    //     'apps/my-app/.eslintrc.json': `{ "ignorePatterns": ["**/*"] }`,
    //     'apps/my-app/project.json': `{}`,
    //     'apps/my-app/index.ts': `console.log('hello world')`,
    //     'libs/my-lib/.eslintrc.json': `{ "ignorePatterns": ["**/*"] }`,
    //     'libs/my-lib/project.json': `{}`,
    //     'libs/my-lib/index.ts': `console.log('hello world')`,
    //   });
    //   expect(
    //     await invokeCreateNodesOnMatchingFiles(context, { targetName: 'lint' })
    //   ).toMatchInlineSnapshot(`
    //     {
    //       "projects": {},
    //     }
    //   `);
    // });
  });

  describe('root eslint config and nested eslint configs', () => {
    it('should insert projects in input order when one root config governs multiple nested projects', async () => {
      // Regression coverage for the `Promise.all`-with-shared-mutation race
      // in `internalCreateNodesV2`: pre-fix, `projects[projectRoot] = project`
      // was assigned from inside `Promise.all`, so key insertion order
      // tracked which async branch (`eslint.isPathIgnored`,
      // `getProjectUsingESLintConfig`) finished first. The fix collects
      // contributions and assembles `projects` in
      // `projectRootsByEslintRoots.get(configDir)` order — i.e. input order.
      //
      // Inputs are presented in non-alphabetic order so the assertion
      // proves the plugin preserves input order rather than coincidentally
      // alphabetizing.
      createFiles({
        '.eslintrc.json': `{}`,
        'libs/c-lib/project.json': `{}`,
        'libs/c-lib/index.ts': `console.log('c')`,
        'libs/a-lib/project.json': `{}`,
        'libs/a-lib/index.ts': `console.log('a')`,
        'libs/b-lib/project.json': `{}`,
        'libs/b-lib/index.ts': `console.log('b')`,
      });
      const result = await invokeCreateNodesOnMatchingFiles(context, {
        targetName: 'lint',
      });
      // configFiles is built from Object.keys(fileSys) in this test harness,
      // so the input order seen by the plugin is c-lib, a-lib, b-lib. With
      // the fix, that is the exact order the plugin emits.
      expect(Object.keys(result.projects)).toEqual([
        'libs/c-lib',
        'libs/a-lib',
        'libs/b-lib',
      ]);
    });

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
      expect(
        await invokeCreateNodesOnMatchingFiles(context, { targetName: 'lint' })
      ).toMatchInlineSnapshot(`
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
                    "{workspaceRoot}/apps/my-app/.eslintrc.json",
                    "{workspaceRoot}/tools/eslint-rules/**/*",
                    {
                      "externalDependencies": [
                        "eslint",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Runs ESLint on project",
                    "help": {
                      "command": "npx eslint --help",
                      "example": {
                        "options": {
                          "max-warnings": 0,
                        },
                      },
                    },
                    "technologies": [
                      "eslint",
                    ],
                  },
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
                    "{workspaceRoot}/libs/my-lib/.eslintrc.json",
                    "{workspaceRoot}/tools/eslint-rules/**/*",
                    {
                      "externalDependencies": [
                        "eslint",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Runs ESLint on project",
                    "help": {
                      "command": "npx eslint --help",
                      "example": {
                        "options": {
                          "max-warnings": 0,
                        },
                      },
                    },
                    "technologies": [
                      "eslint",
                    ],
                  },
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
      expect(
        await invokeCreateNodesOnMatchingFiles(context, { targetName: 'lint' })
      ).toMatchInlineSnapshot(`
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
                  "metadata": {
                    "description": "Runs ESLint on project",
                    "help": {
                      "command": "npx eslint --help",
                      "example": {
                        "options": {
                          "max-warnings": 0,
                        },
                      },
                    },
                    "technologies": [
                      "eslint",
                    ],
                  },
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
        'apps/myapp/project.json': '{}',
        'apps/myapp/index.ts': 'console.log("hello world")',
        'apps/myapp/nested/mylib/.eslintrc.json': JSON.stringify({
          extends: '../../../../.eslintrc.json',
          ignorePatterns: ['!**/*'], // include all files, create task
        }),
        'apps/myapp/nested/mylib/project.json': '{}',
        'apps/myapp/nested/mylib/index.ts': 'console.log("hello world")',
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(context, { targetName: 'lint' })
      ).toMatchInlineSnapshot(`
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
                    "{workspaceRoot}/apps/myapp/nested/mylib/.eslintrc.json",
                    "{workspaceRoot}/tools/eslint-rules/**/*",
                    {
                      "externalDependencies": [
                        "eslint",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Runs ESLint on project",
                    "help": {
                      "command": "npx eslint --help",
                      "example": {
                        "options": {
                          "max-warnings": 0,
                        },
                      },
                    },
                    "technologies": [
                      "eslint",
                    ],
                  },
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

    it('should determine ESLint class from root config, not nested stray configs', async () => {
      createFiles({
        'eslint.config.mjs': `export default [];`,
        'package.json': `{}`,
        'eslint-local-rules/.eslintrc.json': `{}`,
        'apps/my-app/project.json': `{}`,
        'apps/my-app/index.ts': `console.log('hello world')`,
      });
      // FlatESLint instantiation may fail in jest due to dynamic imports,
      // but we only need to verify the correct config type was selected
      try {
        await invokeCreateNodesOnMatchingFiles(context, {
          targetName: 'lint',
        });
      } catch (e) {
        // Re-throw if failure happened before resolveESLintClass was called
        if (resolveESLintClassSpy.mock.calls.length === 0) {
          throw e;
        }
      }
      // Root config is eslint.config.mjs (flat) — should use flat config
      // regardless of stray .eslintrc.json in eslint-local-rules/
      expect(resolveESLintClassSpy).toHaveBeenCalledWith({
        useFlatConfigOverrideVal: true,
      });
    });
  });

  describe('plugin options', () => {
    it('should use the default target name when no options are provided', async () => {
      createFiles({
        '.eslintrc.json': `{}`,
        'package.json': `{}`,
        'src/index.ts': `console.log('hello world')`,
      });
      expect(await invokeCreateNodesOnMatchingFiles(context))
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
                    "{workspaceRoot}/.eslintrc.json",
                    "{workspaceRoot}/tools/eslint-rules/**/*",
                    {
                      "externalDependencies": [
                        "eslint",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Runs ESLint on project",
                    "help": {
                      "command": "npx eslint --help",
                      "example": {
                        "options": {
                          "max-warnings": 0,
                        },
                      },
                    },
                    "technologies": [
                      "eslint",
                    ],
                  },
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

    it('should use the custom target name when the target name is provided', async () => {
      createFiles({
        '.eslintrc.json': `{}`,
        'package.json': `{}`,
        'src/index.ts': `console.log('hello world')`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          targetName: 'custom-lint',
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            ".": {
              "targets": {
                "custom-lint": {
                  "cache": true,
                  "command": "eslint ./src",
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
                  "metadata": {
                    "description": "Runs ESLint on project",
                    "help": {
                      "command": "npx eslint --help",
                      "example": {
                        "options": {
                          "max-warnings": 0,
                        },
                      },
                    },
                    "technologies": [
                      "eslint",
                    ],
                  },
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
  });

  describe('tsconfig extends chain inputs', () => {
    it('should not add tsconfig inputs when the project has no tsconfig.json', async () => {
      createFiles({
        '.eslintrc.json': `{}`,
        'apps/my-app/project.json': `{}`,
        'apps/my-app/index.ts': `console.log('hello world')`,
      });
      const result = await invokeCreateNodesOnMatchingFiles(context, {
        targetName: 'lint',
      });
      const inputs = result.projects['apps/my-app'].targets.lint.inputs;
      expect(inputs).not.toContainEqual(expect.stringMatching(/tsconfig/i));
    });

    it('should not add tsconfig inputs when tsconfig.json has no extends', async () => {
      createFiles({
        '.eslintrc.json': `{}`,
        'apps/my-app/project.json': `{}`,
        'apps/my-app/index.ts': `console.log('hello world')`,
        'apps/my-app/tsconfig.json': `{}`,
      });
      const result = await invokeCreateNodesOnMatchingFiles(context, {
        targetName: 'lint',
      });
      const inputs = result.projects['apps/my-app'].targets.lint.inputs;
      expect(inputs).not.toContainEqual(expect.stringContaining('tsconfig'));
    });

    it('should not add tsconfig inputs when extends points inside the project root', async () => {
      createFiles({
        '.eslintrc.json': `{}`,
        'apps/my-app/project.json': `{}`,
        'apps/my-app/index.ts': `console.log('hello world')`,
        'apps/my-app/tsconfig.json': JSON.stringify({
          extends: './tsconfig.lib.json',
        }),
        'apps/my-app/tsconfig.lib.json': `{}`,
      });
      const result = await invokeCreateNodesOnMatchingFiles(context, {
        targetName: 'lint',
      });
      const inputs = result.projects['apps/my-app'].targets.lint.inputs;
      expect(inputs).not.toContainEqual(expect.stringContaining('tsconfig'));
    });

    it('should exclude the root tsconfig from inputs since it is handled by the native selective hasher', async () => {
      createFiles({
        '.eslintrc.json': `{}`,
        'tsconfig.base.json': `{}`,
        'apps/my-app/project.json': `{}`,
        'apps/my-app/index.ts': `console.log('hello world')`,
        'apps/my-app/tsconfig.json': JSON.stringify({
          extends: '../../tsconfig.base.json',
        }),
      });
      const result = await invokeCreateNodesOnMatchingFiles(context, {
        targetName: 'lint',
      });
      const inputs = result.projects['apps/my-app'].targets.lint.inputs;
      expect(inputs).not.toContain('{workspaceRoot}/tsconfig.base.json');
    });

    it('should add the tsconfig file to inputs when extends points outside the project root', async () => {
      createFiles({
        '.eslintrc.json': `{}`,
        'tsconfig.shared.json': `{}`,
        'apps/my-app/project.json': `{}`,
        'apps/my-app/index.ts': `console.log('hello world')`,
        'apps/my-app/tsconfig.json': JSON.stringify({
          extends: '../../tsconfig.shared.json',
        }),
      });
      const result = await invokeCreateNodesOnMatchingFiles(context, {
        targetName: 'lint',
      });
      const inputs = result.projects['apps/my-app'].targets.lint.inputs;
      expect(inputs).toContain('{workspaceRoot}/tsconfig.shared.json');
    });

    it('should add every file in a transitive extends chain that lives outside the project root except the root tsconfig', async () => {
      createFiles({
        '.eslintrc.json': `{}`,
        'tsconfig.root.json': `{}`,
        'tsconfig.base.json': JSON.stringify({
          extends: './tsconfig.root.json',
        }),
        'apps/my-app/project.json': `{}`,
        'apps/my-app/index.ts': `console.log('hello world')`,
        'apps/my-app/tsconfig.json': JSON.stringify({
          extends: '../../tsconfig.base.json',
        }),
      });
      const result = await invokeCreateNodesOnMatchingFiles(context, {
        targetName: 'lint',
      });
      const inputs = result.projects['apps/my-app'].targets.lint.inputs;
      expect(inputs).not.toContain('{workspaceRoot}/tsconfig.base.json');
      expect(inputs).toContain('{workspaceRoot}/tsconfig.root.json');
    });

    it('should add every file when extends is an array', async () => {
      createFiles({
        '.eslintrc.json': `{}`,
        'tsconfig.a.json': `{}`,
        'tsconfig.b.json': `{}`,
        'apps/my-app/project.json': `{}`,
        'apps/my-app/index.ts': `console.log('hello world')`,
        'apps/my-app/tsconfig.json': JSON.stringify({
          extends: ['../../tsconfig.a.json', '../../tsconfig.b.json'],
        }),
      });
      const result = await invokeCreateNodesOnMatchingFiles(context, {
        targetName: 'lint',
      });
      const inputs = result.projects['apps/my-app'].targets.lint.inputs;
      expect(inputs).toContain('{workspaceRoot}/tsconfig.a.json');
      expect(inputs).toContain('{workspaceRoot}/tsconfig.b.json');
    });

    it('should drop shareable tsconfig packages resolved from node_modules', async () => {
      createFiles({
        '.eslintrc.json': `{}`,
        'node_modules/@some/preset/package.json': JSON.stringify({
          name: '@some/preset',
        }),
        'node_modules/@some/preset/tsconfig.json': `{}`,
        'apps/my-app/project.json': `{}`,
        'apps/my-app/index.ts': `console.log('hello world')`,
        'apps/my-app/tsconfig.json': JSON.stringify({
          extends: '@some/preset/tsconfig.json',
        }),
      });
      const result = await invokeCreateNodesOnMatchingFiles(context, {
        targetName: 'lint',
      });
      const inputs = result.projects['apps/my-app'].targets.lint.inputs;
      expect(inputs).not.toContainEqual(
        expect.stringContaining('node_modules')
      );
      expect(inputs).not.toContainEqual(
        expect.stringContaining('@some/preset')
      );
    });

    it('should not crash on a self-referential extends cycle', async () => {
      createFiles({
        '.eslintrc.json': `{}`,
        'tsconfig.a.json': JSON.stringify({
          extends: './tsconfig.b.json',
        }),
        'tsconfig.b.json': JSON.stringify({
          extends: './tsconfig.a.json',
        }),
        'apps/my-app/project.json': `{}`,
        'apps/my-app/index.ts': `console.log('hello world')`,
        'apps/my-app/tsconfig.json': JSON.stringify({
          extends: '../../tsconfig.a.json',
        }),
      });
      const result = await invokeCreateNodesOnMatchingFiles(context, {
        targetName: 'lint',
      });
      const inputs = result.projects['apps/my-app'].targets.lint.inputs;
      expect(inputs).toContain('{workspaceRoot}/tsconfig.a.json');
      expect(inputs).toContain('{workspaceRoot}/tsconfig.b.json');
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
    options?: EslintPluginOptions
  ) {
    const aggregateProjects: Record<string, any> = {};
    const results = await createNodesV2[1](configFiles, options, context);
    for (const [, nodes] of results) {
      Object.assign(aggregateProjects, nodes.projects);
    }
    return {
      projects: aggregateProjects,
    };
  }
});
