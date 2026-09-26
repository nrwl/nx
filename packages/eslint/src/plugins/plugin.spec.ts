import {
  calculateHashesForCreateNodes,
  globWithWorkspaceContext,
} from '@nx/devkit/internal';
import { CreateNodesContext } from '@nx/devkit';
import { minimatch } from 'minimatch';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createNodesV2, EslintPluginOptions } from './plugin';
import { mkdirSync, rmSync } from 'fs';

jest.mock('@nx/devkit/internal', () => {
  const actual = jest.requireActual('@nx/devkit/internal');
  return {
    ...actual,
    calculateHashesForCreateNodes: jest.fn(
      actual.calculateHashesForCreateNodes
    ),
    globWithWorkspaceContext: jest.fn(actual.globWithWorkspaceContext),
  };
});

jest.mock('nx/src/utils/cache-directory', () => ({
  ...jest.requireActual('nx/src/utils/cache-directory'),
  workspaceDataDirectory: 'tmp/project-graph-cache',
}));

const resolveESLintClassSpy = jest.fn();
let mockESLintClass: unknown = null;
jest.mock('../utils/resolve-eslint-class', () => ({
  resolveESLintClass: (...args) => {
    resolveESLintClassSpy(...args);
    if (mockESLintClass) {
      return mockESLintClass;
    }
    return jest
      .requireActual('../utils/resolve-eslint-class')
      .resolveESLintClass(...args);
  },
}));

describe('@nx/eslint/plugin', () => {
  let context: CreateNodesContext;
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
    mockESLintClass = null;
    jest.mocked(calculateHashesForCreateNodes).mockClear();
    jest.mocked(globWithWorkspaceContext).mockClear();
    tempFs.cleanup();
    tempFs = null;
    rmSync('tmp/project-graph-cache', { recursive: true, force: true });
  });

  describe('config hash inputs', () => {
    async function captureInputs(files: string[]) {
      const captured = new Error('Hash inputs captured');
      jest.mocked(globWithWorkspaceContext).mockResolvedValueOnce([]);
      jest
        .mocked(calculateHashesForCreateNodes)
        .mockRejectedValueOnce(captured);
      await expect(createNodesV2[1](files, {}, context)).rejects.toBe(captured);
      const [roots, , , inputs] = jest
        .mocked(calculateHashesForCreateNodes)
        .mock.calls.at(-1);
      return Object.fromEntries(
        roots.map((root, index) => [root, inputs[index]])
      );
    }

    it('hashes strict descendant configs in discovery order, including duplicates', async () => {
      const configs = [
        'libs/a/nested/eslint.config.js',
        'libs/ab/eslint.config.js',
        'eslint.config.js',
        'libs/a/eslint.config.js',
        'libs/a/nested/.eslintrc.json',
        'libs/a/nested/eslint.config.js',
      ];
      expect(
        await captureInputs([
          ...configs,
          'libs/a/nested/project.json',
          'project.json',
          'libs/a/project.json',
          'libs/project.json',
          'apps/absent/project.json',
        ])
      ).toEqual({
        'libs/a/nested': ['libs/a/nested/.eslintignore', 'package-lock.json'],
        '.': [...configs, '.eslintignore', 'package-lock.json'],
        'libs/a': [
          configs[0],
          configs[4],
          configs[5],
          'libs/a/.eslintignore',
          'package-lock.json',
        ],
        libs: [
          configs[0],
          configs[1],
          configs[3],
          configs[4],
          configs[5],
          'libs/.eslintignore',
          'package-lock.json',
        ],
        'apps/absent': ['apps/absent/.eslintignore', 'package-lock.json'],
      });
    });

    it('normalizes descendant paths without extending the literal-dot exception', async () => {
      const configs = [
        'eslint.config.js',
        'a/eslint.config.js',
        'a/b/eslint.config.js',
        'a//c/eslint.config.js',
        'a/./d/eslint.config.js',
        'ab/eslint.config.js',
      ];
      const descendants = [configs[2], configs[3], configs[4]];
      expect(
        await captureInputs([
          ...configs,
          'project.json',
          '././project.json',
          './a/project.json',
          'a//project.json',
          'a/child/../project.json',
          'a/b/project.json',
        ])
      ).toEqual({
        '.': [...configs, '.eslintignore', 'package-lock.json'],
        './.': ['.eslintignore', 'package-lock.json'],
        './a': [...descendants, 'a/.eslintignore', 'package-lock.json'],
        'a/': [...descendants, 'a/.eslintignore', 'package-lock.json'],
        'a/child/..': [...descendants, 'a/.eslintignore', 'package-lock.json'],
        'a/b': ['a/b/.eslintignore', 'package-lock.json'],
      });
    });

    it('uses the scoped config list supplied to each invocation', async () => {
      const project = 'libs/a/project.json';
      const nested = 'libs/a/nested/eslint.config.js';
      expect(await captureInputs([project, nested])).toEqual({
        'libs/a': [nested, 'libs/a/.eslintignore', 'package-lock.json'],
      });
      expect(await captureInputs([project, 'libs/b/eslint.config.js'])).toEqual(
        {
          'libs/a': ['libs/a/.eslintignore', 'package-lock.json'],
        }
      );
      expect(await captureInputs([project, nested])).toEqual({
        'libs/a': [nested, 'libs/a/.eslintignore', 'package-lock.json'],
      });
    });
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
      // NOTE: a flat config (eslint.config.cjs) needs no env var; flat is the default for ESLint v9+
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
                    "env": {
                      "ESLINT_USE_FLAT_CONFIG": "false",
                    },
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
                    "env": {
                      "ESLINT_USE_FLAT_CONFIG": "false",
                    },
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
                    "env": {
                      "ESLINT_USE_FLAT_CONFIG": "false",
                    },
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
                    "env": {
                      "ESLINT_USE_FLAT_CONFIG": "false",
                    },
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
                    "env": {
                      "ESLINT_USE_FLAT_CONFIG": "false",
                    },
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
                    "env": {
                      "ESLINT_USE_FLAT_CONFIG": "false",
                    },
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
                    "env": {
                      "ESLINT_USE_FLAT_CONFIG": "false",
                    },
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
                    "env": {
                      "ESLINT_USE_FLAT_CONFIG": "false",
                    },
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
                    "env": {
                      "ESLINT_USE_FLAT_CONFIG": "false",
                    },
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
                    "env": {
                      "ESLINT_USE_FLAT_CONFIG": "false",
                    },
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
                    "env": {
                      "ESLINT_USE_FLAT_CONFIG": "false",
                    },
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
                    "env": {
                      "ESLINT_USE_FLAT_CONFIG": "false",
                    },
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

  describe('flat config inputs', () => {
    function installPackage(name: string) {
      tempFs.createFileSync(
        `node_modules/${name}/package.json`,
        JSON.stringify({ name, version: '1.0.0' })
      );
    }

    it('should add packages imported by the root flat config as external dependencies', async () => {
      // ESLint loads flat configs with a dynamic import, which jest cannot run
      mockESLintClass = class {
        async isPathIgnored() {
          return false;
        }
      };
      installPackage('@nx/eslint-plugin');
      installPackage('typescript-eslint');
      createFiles({
        'eslint.config.mjs': `
          import nx from '@nx/eslint-plugin';
          import tseslint from 'typescript-eslint';
          export default [];
        `,
        'apps/my-app/project.json': `{}`,
        'apps/my-app/index.ts': `console.log('hello world')`,
      });
      const result = await invokeCreateNodesOnMatchingFiles(context, {
        targetName: 'lint',
      });
      const inputs = result.projects['apps/my-app'].targets.lint.inputs;
      expect(inputs).toContainEqual({
        externalDependencies: [
          'eslint',
          '@nx/eslint-plugin',
          'typescript-eslint',
        ],
      });
    });

    it('should recompute inputs when the imports of an ancestor flat config change', async () => {
      mockESLintClass = class {
        async isPathIgnored() {
          return false;
        }
      };
      installPackage('eslint-plugin-a');
      installPackage('eslint-plugin-b');
      createFiles({
        'eslint.config.mjs': `
          import a from 'eslint-plugin-a';
          export default [];
        `,
        'apps/my-app/project.json': `{}`,
        'apps/my-app/index.ts': `console.log('hello world')`,
      });
      const first = await invokeCreateNodesOnMatchingFiles(context, {
        targetName: 'lint',
      });
      expect(first.projects['apps/my-app'].targets.lint.inputs).toContainEqual({
        externalDependencies: ['eslint', 'eslint-plugin-a'],
      });

      tempFs.createFileSync(
        'eslint.config.mjs',
        `
          import b from 'eslint-plugin-b';
          export default [];
        `
      );
      const second = await invokeCreateNodesOnMatchingFiles(context, {
        targetName: 'lint',
      });
      expect(second.projects['apps/my-app'].targets.lint.inputs).toContainEqual(
        { externalDependencies: ['eslint', 'eslint-plugin-b'] }
      );
    });

    it('should merge packages imported by the project flat config and the root config it extends', async () => {
      installPackage('@nx/eslint-plugin');
      installPackage('eslint-plugin-react');
      createFiles({
        'eslint.config.mjs': `
          import nx from '@nx/eslint-plugin';
          export default [];
        `,
        'apps/my-app/eslint.config.mjs': `
          import baseConfig from '../../eslint.config.mjs';
          import react from 'eslint-plugin-react';
          export default [...baseConfig];
        `,
        'apps/my-app/project.json': `{}`,
        'apps/my-app/index.ts': `console.log('hello world')`,
      });
      const result = await invokeCreateNodesOnMatchingFiles(context, {
        targetName: 'lint',
      });
      const inputs = result.projects['apps/my-app'].targets.lint.inputs;
      expect(inputs).toContainEqual({
        externalDependencies: [
          'eslint',
          '@nx/eslint-plugin',
          'eslint-plugin-react',
        ],
      });
      expect(
        inputs.filter((input) => input === '{workspaceRoot}/eslint.config.mjs')
      ).toHaveLength(1);
    });

    it('should add files outside the project reached via relative imports as inputs', async () => {
      installPackage('eslint-plugin-react');
      createFiles({
        'eslint.config.mjs': `export default [];`,
        'tools/eslint/react.mjs': `
          import react from 'eslint-plugin-react';
          export default [];
        `,
        'apps/my-app/eslint.config.mjs': `
          import reactConfig from '../../tools/eslint/react.mjs';
          export default [...reactConfig];
        `,
        'apps/my-app/project.json': `{}`,
        'apps/my-app/index.ts': `console.log('hello world')`,
      });
      const result = await invokeCreateNodesOnMatchingFiles(context, {
        targetName: 'lint',
      });
      const inputs = result.projects['apps/my-app'].targets.lint.inputs;
      expect(inputs).toContain('{workspaceRoot}/tools/eslint/react.mjs');
      expect(inputs).toContainEqual({
        externalDependencies: ['eslint', 'eslint-plugin-react'],
      });
    });

    it('should not add file inputs for relative imports inside the project root', async () => {
      createFiles({
        'eslint.config.mjs': `export default [];`,
        'apps/my-app/eslint.config.mjs': `
          import local from './eslint.local.mjs';
          export default [...local];
        `,
        'apps/my-app/eslint.local.mjs': `export default [];`,
        'apps/my-app/project.json': `{}`,
        'apps/my-app/index.ts': `console.log('hello world')`,
      });
      const result = await invokeCreateNodesOnMatchingFiles(context, {
        targetName: 'lint',
      });
      const inputs = result.projects['apps/my-app'].targets.lint.inputs;
      expect(inputs).not.toContainEqual(
        expect.stringContaining('eslint.local.mjs')
      );
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
    context: CreateNodesContext,
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
