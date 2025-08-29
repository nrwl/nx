import { detectPackageManager, type CreateNodesContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import picomatch = require('picomatch');
import { mkdirSync, rmdirSync } from 'node:fs';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getLockFileName } from 'nx/src/plugins/js/lock-file/lock-file';
import { setupWorkspaceContext } from 'nx/src/utils/workspace-context';
import { PLUGIN_NAME, createNodesV2, type TscPluginOptions } from './plugin';

jest.mock('nx/src/utils/cache-directory', () => ({
  ...jest.requireActual('nx/src/utils/cache-directory'),
  workspaceDataDirectory: 'tmp/project-graph-cache',
}));

describe(`Plugin: ${PLUGIN_NAME}`, () => {
  let context: CreateNodesContext;
  let cwd = process.cwd();
  let tempFs: TempFs;
  let originalCacheProjectGraph: string | undefined;
  let lockFileName: string;

  beforeEach(() => {
    mkdirSync('tmp/project-graph-cache', { recursive: true });
    tempFs = new TempFs('typescript-plugin');
    context = {
      nxJsonConfiguration: {
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['!{projectRoot}/**/*.spec.ts'],
        },
      },
      workspaceRoot: tempFs.tempDir,
      configFiles: [],
    };
    process.chdir(tempFs.tempDir);
    originalCacheProjectGraph = process.env.NX_CACHE_PROJECT_GRAPH;
    process.env.NX_CACHE_PROJECT_GRAPH = 'false';
    lockFileName = getLockFileName(detectPackageManager(context.workspaceRoot));
    applyFilesToTempFsAndContext(tempFs, context, { [lockFileName]: '' });
  });

  afterEach(() => {
    jest.resetModules();
    tempFs.cleanup();
    process.chdir(cwd);
    process.env.NX_CACHE_PROJECT_GRAPH = originalCacheProjectGraph;
    rmdirSync('tmp/project-graph-cache', { recursive: true });
  });

  it('should handle missing lock file', async () => {
    await applyFilesToTempFsAndContext(tempFs, context, {
      'libs/my-lib/tsconfig.json': JSON.stringify({ files: [] }),
      'libs/my-lib/package.json': `{}`,
    });
    tempFs.removeFileSync(lockFileName);

    await expect(
      invokeCreateNodesOnMatchingFiles(context, {})
    ).resolves.not.toThrow();
  });

  it('should not create nodes for root tsconfig.json files', async () => {
    await applyFilesToTempFsAndContext(tempFs, context, {
      'package.json': `{}`,
      'project.json': `{}`,
      'tsconfig.json': `{}`,
      'src/index.ts': `console.log('Hello World!');`,
    });
    expect(await invokeCreateNodesOnMatchingFiles(context, {}))
      .toMatchInlineSnapshot(`
      {
        "projects": {},
      }
    `);
  });

  describe('typecheck target', () => {
    it('should create a node with a typecheck target for a project level tsconfig.json file by default (when there is a sibling package.json or project.json)', async () => {
      // Sibling package.json
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': JSON.stringify({ files: [] }),
        'libs/my-lib/package.json': `{}`,
      });
      expect(await invokeCreateNodesOnMatchingFiles(context, {}))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "typecheck": {
                  "cache": true,
                  "command": "tsc --build --emitDeclarationOnly",
                  "dependsOn": [
                    "^typecheck",
                  ],
                  "inputs": [
                    "production",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Runs type-checking for the project.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);

      // Sibling project.json
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': JSON.stringify({ files: [] }),
        'libs/my-lib/project.json': `{}`,
      });
      expect(await invokeCreateNodesOnMatchingFiles(context, {}))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "typecheck": {
                  "cache": true,
                  "command": "tsc --build --emitDeclarationOnly",
                  "dependsOn": [
                    "^typecheck",
                  ],
                  "inputs": [
                    "production",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Runs type-checking for the project.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);

      // Other tsconfigs present
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': JSON.stringify({ files: [] }),
        'libs/my-lib/tsconfig.lib.json': `{}`,
        'libs/my-lib/tsconfig.build.json': `{}`,
        'libs/my-lib/tsconfig.spec.json': `{}`,
        'libs/my-lib/project.json': `{}`,
      });
      expect(await invokeCreateNodesOnMatchingFiles(context, {}))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "typecheck": {
                  "cache": true,
                  "command": "tsc --build --emitDeclarationOnly",
                  "dependsOn": [
                    "^typecheck",
                  ],
                  "inputs": [
                    "production",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Runs type-checking for the project.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should create a node with a typecheck target with "--verbose" flag when the "verboseOutput" plugin option is true', async () => {
      // Sibling package.json
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': JSON.stringify({ files: [] }),
        'libs/my-lib/package.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(context, { verboseOutput: true })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "typecheck": {
                  "cache": true,
                  "command": "tsc --build --emitDeclarationOnly --verbose",
                  "dependsOn": [
                    "^typecheck",
                  ],
                  "inputs": [
                    "production",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Runs type-checking for the project.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);

      // Sibling project.json
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': JSON.stringify({ files: [] }),
        'libs/my-lib/project.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(context, { verboseOutput: true })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "typecheck": {
                  "cache": true,
                  "command": "tsc --build --emitDeclarationOnly --verbose",
                  "dependsOn": [
                    "^typecheck",
                  ],
                  "inputs": [
                    "production",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Runs type-checking for the project.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);

      // Other tsconfigs present
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': JSON.stringify({ files: [] }),
        'libs/my-lib/tsconfig.lib.json': `{}`,
        'libs/my-lib/tsconfig.build.json': `{}`,
        'libs/my-lib/tsconfig.spec.json': `{}`,
        'libs/my-lib/project.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(context, { verboseOutput: true })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "typecheck": {
                  "cache": true,
                  "command": "tsc --build --emitDeclarationOnly --verbose",
                  "dependsOn": [
                    "^typecheck",
                  ],
                  "inputs": [
                    "production",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Runs type-checking for the project.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should not create typecheck target for a project level tsconfig.json file if set to false in plugin options', async () => {
      // Sibling package.json
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/package.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {},
            },
          },
        }
      `);

      // Sibling project.json
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/project.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {},
            },
          },
        }
      `);
    });

    it('should not invoke `tsc --build` when `noEmit` is set in the tsconfig.json file', async () => {
      // set directly in tsconfig.json file
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': JSON.stringify({
          compilerOptions: { noEmit: true },
          files: [],
        }),
        'libs/my-lib/package.json': `{}`,
      });
      expect(await invokeCreateNodesOnMatchingFiles(context, {}))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "typecheck": {
                  "cache": true,
                  "command": "echo "The 'typecheck' target is disabled because one or more project references set 'noEmit: true' in their tsconfig. Remove this property to resolve this issue."",
                  "dependsOn": [
                    "^typecheck",
                  ],
                  "inputs": [
                    "production",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Runs type-checking for the project.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);

      // set in extended tsconfig file
      await applyFilesToTempFsAndContext(tempFs, context, {
        'tsconfig.base.json': JSON.stringify({
          compilerOptions: { noEmit: true },
        }),
        'libs/my-lib/tsconfig.json': JSON.stringify({
          extends: '../../tsconfig.base.json',
          files: [],
        }),
        'libs/my-lib/package.json': `{}`,
      });
      expect(await invokeCreateNodesOnMatchingFiles(context, {}))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "typecheck": {
                  "cache": true,
                  "command": "echo "The 'typecheck' target is disabled because one or more project references set 'noEmit: true' in their tsconfig. Remove this property to resolve this issue."",
                  "dependsOn": [
                    "^typecheck",
                  ],
                  "inputs": [
                    "production",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Runs type-checking for the project.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should not invoke `tsc --build` when `noEmit` is set in any of the referenced tsconfig.json files', async () => {
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': JSON.stringify({
          files: [],
          references: [{ path: './tsconfig.lib.json' }],
        }),
        'libs/my-lib/tsconfig.lib.json': JSON.stringify({
          compilerOptions: { noEmit: true },
          files: [],
        }),
        'libs/my-lib/package.json': `{}`,
      });
      expect(await invokeCreateNodesOnMatchingFiles(context, {}))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "typecheck": {
                  "cache": true,
                  "command": "echo "The 'typecheck' target is disabled because one or more project references set 'noEmit: true' in their tsconfig. Remove this property to resolve this issue."",
                  "dependsOn": [
                    "^typecheck",
                  ],
                  "inputs": [
                    "production",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Runs type-checking for the project.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should handle ts project references pointing to non-existing files and not throw', async () => {
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': JSON.stringify({
          references: [{ path: '../my-lib-2' }],
        }),
        'libs/my-lib/package.json': `{}`,
      });

      await expect(
        invokeCreateNodesOnMatchingFiles(context, {})
      ).resolves.not.toThrow();
    });

    it('should not infer typecheck target when nx.addTypecheckTarget is false in tsconfig.json', async () => {
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': JSON.stringify({
          nx: { addTypecheckTarget: false },
        }),
        'libs/my-lib/tsconfig.lib.json': JSON.stringify({
          compilerOptions: { outDir: 'out-tsc/my-lib', rootDir: 'src' },
          files: ['src/main.ts'],
        }),
        'libs/my-lib/package.json': `{}`,
      });

      await expect(
        invokeCreateNodesOnMatchingFiles(context, {
          build: {
            configName: 'tsconfig.lib.json',
          },
        })
      ).resolves.toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "build": {
                  "cache": true,
                  "command": "tsc --build tsconfig.lib.json",
                  "dependsOn": [
                    "^build",
                  ],
                  "inputs": [
                    "production",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Builds the project with \`tsc\`.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [
                    "{projectRoot}/out-tsc/my-lib",
                    "{projectRoot}/out-tsc/*.tsbuildinfo",
                  ],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    describe('inputs', () => {
      it('should add the config file and the `include` and `exclude` patterns', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            include: ['src/**/*.ts'],
            exclude: ['src/**/foo.ts'],
            // set this to keep outputs smaller
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/package.json': `{}`,
        });
        expect(await invokeCreateNodesOnMatchingFiles(context, {}))
          .toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{projectRoot}/tsconfig.json",
                      "{projectRoot}/src/**/*.ts",
                      "!{projectRoot}/src/**/foo.ts",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist/**/*.d.ts",
                      "{projectRoot}/dist/tsconfig.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should add the config file and the `include` and `exclude` patterns using the "${configDir}" template', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            include: ['${configDir}/src/**/*.ts'],
            exclude: ['${configDir}/src/**/foo.ts'],
            // set this to keep outputs smaller
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/package.json': `{}`,
        });
        expect(await invokeCreateNodesOnMatchingFiles(context, {}))
          .toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{projectRoot}/tsconfig.json",
                      "{projectRoot}/src/**/*.ts",
                      "!{projectRoot}/src/**/foo.ts",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist/**/*.d.ts",
                      "{projectRoot}/dist/tsconfig.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should normalize and add directories in `include` with the ts extensions', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            include: ['src'],
            // set this to keep outputs smaller
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/package.json': `{}`,
        });

        expect(await invokeCreateNodesOnMatchingFiles(context, {}))
          .toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{projectRoot}/tsconfig.json",
                      "{projectRoot}/src/**/*.ts",
                      "{projectRoot}/src/**/*.tsx",
                      "{projectRoot}/src/**/*.d.ts",
                      "{projectRoot}/src/**/*.cts",
                      "{projectRoot}/src/**/*.d.cts",
                      "{projectRoot}/src/**/*.mts",
                      "{projectRoot}/src/**/*.d.mts",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist/**/*.d.ts",
                      "{projectRoot}/dist/tsconfig.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should normalize and add directories in `include` with the ts and js extensions when `allowJs` is true', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            include: ['src'],
            // set this to keep outputs smaller
            compilerOptions: { outDir: 'dist', allowJs: true },
          }),
          'libs/my-lib/package.json': `{}`,
        });

        expect(await invokeCreateNodesOnMatchingFiles(context, {}))
          .toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{projectRoot}/tsconfig.json",
                      "{projectRoot}/src/**/*.ts",
                      "{projectRoot}/src/**/*.tsx",
                      "{projectRoot}/src/**/*.d.ts",
                      "{projectRoot}/src/**/*.js",
                      "{projectRoot}/src/**/*.jsx",
                      "{projectRoot}/src/**/*.cts",
                      "{projectRoot}/src/**/*.d.cts",
                      "{projectRoot}/src/**/*.cjs",
                      "{projectRoot}/src/**/*.mts",
                      "{projectRoot}/src/**/*.d.mts",
                      "{projectRoot}/src/**/*.mjs",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist/**/*.d.ts",
                      "{projectRoot}/dist/tsconfig.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should normalize and add directories in `include` with the ts and json extensions when `resolveJsonModule` is true', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            include: ['src'],
            // set this to keep outputs smaller
            compilerOptions: {
              outDir: 'dist',
              resolveJsonModule: true,
            },
          }),
          'libs/my-lib/package.json': `{}`,
        });

        expect(await invokeCreateNodesOnMatchingFiles(context, {}))
          .toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{projectRoot}/tsconfig.json",
                      "{projectRoot}/src/**/*.ts",
                      "{projectRoot}/src/**/*.tsx",
                      "{projectRoot}/src/**/*.d.ts",
                      "{projectRoot}/src/**/*.cts",
                      "{projectRoot}/src/**/*.d.cts",
                      "{projectRoot}/src/**/*.mts",
                      "{projectRoot}/src/**/*.d.mts",
                      "{projectRoot}/src/**/*.json",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist/**/*.d.ts",
                      "{projectRoot}/dist/tsconfig.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should normalize and add directories in `include` with the ts, js and json extensions when `allowJs` and `resolveJsonModule` are true', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            include: ['src'],
            // set this to keep outputs smaller
            compilerOptions: {
              outDir: 'dist',
              allowJs: true,
              resolveJsonModule: true,
            },
          }),
          'libs/my-lib/package.json': `{}`,
        });

        expect(await invokeCreateNodesOnMatchingFiles(context, {}))
          .toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{projectRoot}/tsconfig.json",
                      "{projectRoot}/src/**/*.ts",
                      "{projectRoot}/src/**/*.tsx",
                      "{projectRoot}/src/**/*.d.ts",
                      "{projectRoot}/src/**/*.js",
                      "{projectRoot}/src/**/*.jsx",
                      "{projectRoot}/src/**/*.cts",
                      "{projectRoot}/src/**/*.d.cts",
                      "{projectRoot}/src/**/*.cjs",
                      "{projectRoot}/src/**/*.mts",
                      "{projectRoot}/src/**/*.d.mts",
                      "{projectRoot}/src/**/*.mjs",
                      "{projectRoot}/src/**/*.json",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist/**/*.d.ts",
                      "{projectRoot}/dist/tsconfig.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should add extended config files', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'tsconfig.base.json': JSON.stringify({
            exclude: ['node_modules', 'tmp'],
          }),
          'tsconfig.foo.json': JSON.stringify({
            extends: './tsconfig.base.json',
          }),
          'libs/my-lib/tsconfig.json': JSON.stringify({
            extends: '../../tsconfig.foo.json',
            include: ['src/**/*.ts'],
            // set this to keep outputs smaller
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/package.json': `{}`,
        });
        expect(await invokeCreateNodesOnMatchingFiles(context, {}))
          .toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{workspaceRoot}/tsconfig.foo.json",
                      "{workspaceRoot}/tsconfig.base.json",
                      "{projectRoot}/tsconfig.json",
                      "{projectRoot}/src/**/*.ts",
                      "!{workspaceRoot}/node_modules",
                      "!{workspaceRoot}/tmp",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist/**/*.d.ts",
                      "{projectRoot}/dist/tsconfig.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should add extended config files when there are multiple extended config files', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'tsconfig.base.json': JSON.stringify({
            exclude: ['node_modules', 'tmp'],
          }),
          'tsconfig.foo.json': '{}',
          'tsconfig.bar.json': JSON.stringify({
            extends: './tsconfig.foo.json',
            exclude: ['node_modules', 'dist'], // extended last, it will override the base config
          }),
          'libs/my-lib/tsconfig.json': JSON.stringify({
            extends: ['../../tsconfig.base.json', '../../tsconfig.bar.json'], // should collect both and any recursive extended configs as inputs
            include: ['src/**/*.ts'],
            // set this to keep outputs smaller
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/package.json': `{}`,
        });
        expect(await invokeCreateNodesOnMatchingFiles(context, {}))
          .toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{workspaceRoot}/tsconfig.base.json",
                      "{workspaceRoot}/tsconfig.bar.json",
                      "{workspaceRoot}/tsconfig.foo.json",
                      "{projectRoot}/tsconfig.json",
                      "{projectRoot}/src/**/*.ts",
                      "!{workspaceRoot}/node_modules",
                      "!{workspaceRoot}/dist",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist/**/*.d.ts",
                      "{projectRoot}/dist/tsconfig.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should add extended config files supporting node.js style resolution and local workspace packages', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'tsconfig.base.json': JSON.stringify({
            extends: '@tsconfig/strictest/tsconfig.json', // should be resolved and the package name should be included in inputs as an external dependency
            exclude: ['node_modules', 'tmp'],
          }),
          'tsconfig.foo.json': JSON.stringify({
            extends: './tsconfig.base', // extensionless relative path
          }),
          'libs/my-lib/tsconfig.json': JSON.stringify({
            extends: [
              '../../tsconfig.foo.json',
              '@my-org/my-package/tsconfig.base.json', // should be resolved and the path should be included in inputs
            ],
            include: ['src/**/*.ts'],
            // set this to keep outputs smaller
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/package.json': `{}`,
          'libs/my-package/package.json': `{}`,
          'libs/my-package/tsconfig.base.json': `{}`,
          // simulate @tsconfig/strictest package
          'node_modules/@tsconfig/strictest/tsconfig.json': '{}',
        });
        // create a symlink to simulate a local workspace package linked by a package manager
        tempFs.createSymlinkSync(
          'libs/my-package',
          'node_modules/@my-org/my-package',
          'dir'
        );

        expect(await invokeCreateNodesOnMatchingFiles(context, {}))
          .toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{workspaceRoot}/tsconfig.foo.json",
                      "{workspaceRoot}/tsconfig.base.json",
                      "{workspaceRoot}/libs/my-package/tsconfig.base.json",
                      "{projectRoot}/tsconfig.json",
                      "{projectRoot}/src/**/*.ts",
                      "!{workspaceRoot}/node_modules",
                      "!{workspaceRoot}/tmp",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                          "@tsconfig/strictest",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist/**/*.d.ts",
                      "{projectRoot}/dist/tsconfig.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should add files from internal project references', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.spec.ts'], // should be ignored because a referenced internal project includes this same pattern
            references: [
              { path: './tsconfig.lib.json' },
              { path: './tsconfig.spec.json' },
              { path: './cypress/tsconfig.json' }, // internal project reference in a nested directory
              { path: './nested-project/tsconfig.json' }, // external project reference in a nested directory
              { path: '../other-lib' }, // external project reference, it causes `dependentTasksOutputFiles` to be set
            ],
            // set this to keep outputs smaller
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.spec.ts'],
            // set this to keep outputs smaller
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/tsconfig.spec.json': JSON.stringify({
            include: ['src/**/*.spec.ts'],
            references: [{ path: './tsconfig.lib.json' }],
            // set this to keep outputs smaller
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/cypress/tsconfig.json': JSON.stringify({
            include: ['**/*.ts', '../cypress.config.ts', '../**/*.cy.ts'],
            references: [{ path: '../tsconfig.lib.json' }],
            // set this to keep outputs smaller
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/package.json': `{}`,
          'libs/my-lib/nested-project/package.json': `{}`,
          'libs/my-lib/nested-project/tsconfig.json': JSON.stringify({
            include: ['lib/**/*.ts'], // different pattern that should not be included in my-lib because it's an external project reference
            // set this to keep outputs smaller
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/other-lib/tsconfig.json': JSON.stringify({
            include: ['**/*.ts'], // different pattern that should not be included because it's an external project
          }),
        });
        expect(await invokeCreateNodesOnMatchingFiles(context, {}))
          .toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{projectRoot}/tsconfig.json",
                      "{projectRoot}/tsconfig.lib.json",
                      "{projectRoot}/tsconfig.spec.json",
                      "{projectRoot}/cypress/tsconfig.json",
                      "{projectRoot}/src/**/*.ts",
                      "{projectRoot}/src/**/*.spec.ts",
                      "{projectRoot}/cypress/**/*.ts",
                      "{projectRoot}/cypress.config.ts",
                      "{projectRoot}/**/*.cy.ts",
                      {
                        "dependentTasksOutputFiles": "**/*.d.ts",
                      },
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist/**/*.d.ts",
                      "{projectRoot}/dist/tsconfig.tsbuildinfo",
                      "{projectRoot}/cypress/dist/**/*.d.ts",
                      "{projectRoot}/cypress/dist/tsconfig.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
              "libs/my-lib/nested-project": {
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{projectRoot}/tsconfig.json",
                      "{projectRoot}/lib/**/*.ts",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib/nested-project",
                    },
                    "outputs": [
                      "{projectRoot}/dist/**/*.d.ts",
                      "{projectRoot}/dist/tsconfig.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should normalize and add directories in `include` from internal project references', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            files: [],
            include: [],
            references: [
              { path: './tsconfig.lib.json' },
              { path: './tsconfig.spec.json' },
            ],
            // set this to keep outputs smaller
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            include: ['src/**/*.ts'],
            exclude: ['tests'], // should be ignored because another referenced internal project includes this same pattern
            // set this to keep outputs smaller
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/tsconfig.spec.json': JSON.stringify({
            include: ['tests'], // directory pattern that should be normalized
            references: [{ path: './tsconfig.lib.json' }],
            compilerOptions: {
              outDir: 'dist', // set this to keep outputs smaller
              allowJs: true, // should result in including js extensions in the normalized include paths
            },
          }),
          'libs/my-lib/package.json': `{}`,
        });

        expect(await invokeCreateNodesOnMatchingFiles(context, {}))
          .toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{projectRoot}/tsconfig.json",
                      "{projectRoot}/tsconfig.lib.json",
                      "{projectRoot}/tsconfig.spec.json",
                      "{projectRoot}/src/**/*.ts",
                      "{projectRoot}/tests/**/*.ts",
                      "{projectRoot}/tests/**/*.tsx",
                      "{projectRoot}/tests/**/*.d.ts",
                      "{projectRoot}/tests/**/*.js",
                      "{projectRoot}/tests/**/*.jsx",
                      "{projectRoot}/tests/**/*.cts",
                      "{projectRoot}/tests/**/*.d.cts",
                      "{projectRoot}/tests/**/*.cjs",
                      "{projectRoot}/tests/**/*.mts",
                      "{projectRoot}/tests/**/*.d.mts",
                      "{projectRoot}/tests/**/*.mjs",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist/**/*.d.ts",
                      "{projectRoot}/dist/tsconfig.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should only add exclude paths that are not part of other tsconfig files include paths', async () => {
        // exact match
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            references: [
              { path: './tsconfig.lib.json' },
              { path: './tsconfig.spec.json' },
            ],
          }),
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.spec.ts'], // should be ignored
          }),
          'libs/my-lib/tsconfig.spec.json': JSON.stringify({
            include: ['src/**/*.spec.ts'],
            references: [{ path: './tsconfig.lib.json' }],
          }),
          'libs/my-lib/package.json': `{}`,
        });

        let result = await invokeCreateNodesOnMatchingFiles(context, {});
        expect(result.projects['libs/my-lib'].targets.typecheck.inputs)
          .toMatchInlineSnapshot(`
          [
            "{projectRoot}/package.json",
            "{projectRoot}/tsconfig.json",
            "{projectRoot}/tsconfig.lib.json",
            "{projectRoot}/tsconfig.spec.json",
            "{projectRoot}/src/**/*.ts",
            "{projectRoot}/src/**/*.spec.ts",
            "^production",
            {
              "externalDependencies": [
                "typescript",
              ],
            },
          ]
        `);

        // other file include pattern is a subset of exclude pattern
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            references: [
              { path: './tsconfig.lib.json' },
              { path: './tsconfig.spec.json' },
            ],
          }),
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            include: ['**/*.ts'],
            exclude: ['**/*.spec.ts'], // should be ignored
          }),
          'libs/my-lib/tsconfig.spec.json': JSON.stringify({
            include: ['src/**/*.spec.ts'],
            references: [{ path: './tsconfig.lib.json' }],
          }),
          'libs/my-lib/package.json': `{}`,
        });
        result = await invokeCreateNodesOnMatchingFiles(context, {});
        expect(result.projects['libs/my-lib'].targets.typecheck.inputs)
          .toMatchInlineSnapshot(`
          [
            "{projectRoot}/package.json",
            "{projectRoot}/tsconfig.json",
            "{projectRoot}/tsconfig.lib.json",
            "{projectRoot}/tsconfig.spec.json",
            "{projectRoot}/**/*.ts",
            "{projectRoot}/src/**/*.spec.ts",
            "^production",
            {
              "externalDependencies": [
                "typescript",
              ],
            },
          ]
        `);

        // exclude pattern is a subset of other file include pattern
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            references: [
              { path: './tsconfig.lib.json' },
              { path: './tsconfig.spec.json' },
            ],
          }),
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.spec.ts'], // should be ignored
          }),
          'libs/my-lib/tsconfig.spec.json': JSON.stringify({
            include: ['**/*.spec.ts'],
            references: [{ path: './tsconfig.lib.json' }],
          }),
          'libs/my-lib/package.json': `{}`,
        });
        result = await invokeCreateNodesOnMatchingFiles(context, {});
        expect(result.projects['libs/my-lib'].targets.typecheck.inputs)
          .toMatchInlineSnapshot(`
          [
            "{projectRoot}/package.json",
            "{projectRoot}/tsconfig.json",
            "{projectRoot}/tsconfig.lib.json",
            "{projectRoot}/tsconfig.spec.json",
            "{projectRoot}/src/**/*.ts",
            "{projectRoot}/**/*.spec.ts",
            "^production",
            {
              "externalDependencies": [
                "typescript",
              ],
            },
          ]
        `);

        // handles mismatches with leading `./`
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            references: [
              { path: './tsconfig.lib.json' },
              { path: './tsconfig.spec.json' },
            ],
          }),
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.spec.ts'], // should be ignored
          }),
          'libs/my-lib/tsconfig.spec.json': JSON.stringify({
            include: ['./**/*.spec.ts'],
            references: [{ path: './tsconfig.lib.json' }],
          }),
          'libs/my-lib/package.json': `{}`,
        });
        result = await invokeCreateNodesOnMatchingFiles(context, {});
        expect(result.projects['libs/my-lib'].targets.typecheck.inputs)
          .toMatchInlineSnapshot(`
          [
            "{projectRoot}/package.json",
            "{projectRoot}/tsconfig.json",
            "{projectRoot}/tsconfig.lib.json",
            "{projectRoot}/tsconfig.spec.json",
            "{projectRoot}/src/**/*.ts",
            "{projectRoot}/**/*.spec.ts",
            "^production",
            {
              "externalDependencies": [
                "typescript",
              ],
            },
          ]
        `);

        // no matching pattern in the exclude list
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            references: [
              { path: './tsconfig.lib.json' },
              { path: './tsconfig.spec.json' },
            ],
          }),
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            include: ['src/**/*.ts'],
            exclude: [
              'src/**/*.spec.ts', // should be ignored
              'src/**/foo.ts', // should be added to inputs as a negative pattern
            ],
          }),
          'libs/my-lib/tsconfig.spec.json': JSON.stringify({
            include: ['**/*.spec.ts'],
            references: [{ path: './tsconfig.lib.json' }],
          }),
          'libs/my-lib/package.json': `{}`,
        });
        result = await invokeCreateNodesOnMatchingFiles(context, {});
        expect(result.projects['libs/my-lib'].targets.typecheck.inputs)
          .toMatchInlineSnapshot(`
          [
            "{projectRoot}/package.json",
            "{projectRoot}/tsconfig.json",
            "{projectRoot}/tsconfig.lib.json",
            "{projectRoot}/tsconfig.spec.json",
            "{projectRoot}/src/**/*.ts",
            "{projectRoot}/**/*.spec.ts",
            "!{projectRoot}/src/**/foo.ts",
            "^production",
            {
              "externalDependencies": [
                "typescript",
              ],
            },
          ]
        `);
      });

      it('should fall back to named inputs when not using include', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({ files: ['main.ts'] }),
          'libs/my-lib/package.json': `{}`,
        });
        expect(await invokeCreateNodesOnMatchingFiles(context, {}))
          .toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/**/*.js",
                      "{projectRoot}/**/*.cjs",
                      "{projectRoot}/**/*.mjs",
                      "{projectRoot}/**/*.jsx",
                      "{projectRoot}/**/*.js.map",
                      "{projectRoot}/**/*.jsx.map",
                      "{projectRoot}/**/*.d.ts",
                      "{projectRoot}/**/*.d.cts",
                      "{projectRoot}/**/*.d.mts",
                      "{projectRoot}/**/*.d.ts.map",
                      "{projectRoot}/**/*.d.cts.map",
                      "{projectRoot}/**/*.d.mts.map",
                      "{projectRoot}/tsconfig.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });
    });

    describe('outputs', () => {
      it('should add the `outFile`', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            compilerOptions: { outFile: '../../dist/libs/my-lib/index.js' },
            files: ['main.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });
        expect(await invokeCreateNodesOnMatchingFiles(context, {}))
          .toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{workspaceRoot}/dist/libs/my-lib/index.js",
                      "{workspaceRoot}/dist/libs/my-lib/index.js.map",
                      "{workspaceRoot}/dist/libs/my-lib/index.d.ts",
                      "{workspaceRoot}/dist/libs/my-lib/index.d.ts.map",
                      "{workspaceRoot}/dist/libs/my-lib/index.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should add the `outDir`', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            compilerOptions: { outDir: '../../dist/libs/my-lib' },
            files: ['main.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });
        expect(await invokeCreateNodesOnMatchingFiles(context, {}))
          .toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{workspaceRoot}/dist/libs/my-lib/**/*.d.ts",
                      "{workspaceRoot}/dist/libs/my-lib/tsconfig.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should include tsbuildinfo file when outDir and rootDir at both set', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            files: [],
            references: [{ path: './tsconfig.lib.json' }],
          }),
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'out-tsc/my-lib', rootDir: 'src' },
            files: ['src/main.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });

        expect(
          await invokeCreateNodesOnMatchingFiles(context, {
            build: {
              configName: 'tsconfig.lib.json',
            },
          })
        ).toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Builds the project with \`tsc\`.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/out-tsc/my-lib",
                      "{projectRoot}/out-tsc/*.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "build",
                      "^typecheck",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/out-tsc/my-lib/**/*.d.ts",
                      "{projectRoot}/out-tsc/*.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should add the inline output files when `outDir` is not defined', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            files: ['main.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });
        expect(await invokeCreateNodesOnMatchingFiles(context, {}))
          .toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/**/*.js",
                      "{projectRoot}/**/*.cjs",
                      "{projectRoot}/**/*.mjs",
                      "{projectRoot}/**/*.jsx",
                      "{projectRoot}/**/*.js.map",
                      "{projectRoot}/**/*.jsx.map",
                      "{projectRoot}/**/*.d.ts",
                      "{projectRoot}/**/*.d.cts",
                      "{projectRoot}/**/*.d.mts",
                      "{projectRoot}/**/*.d.ts.map",
                      "{projectRoot}/**/*.d.cts.map",
                      "{projectRoot}/**/*.d.mts.map",
                      "{projectRoot}/tsconfig.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should collect outputs from all internal project references', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            files: [],
            references: [
              { path: './tsconfig.lib.json' },
              { path: './tsconfig.spec.json' },
              { path: './cypress/tsconfig.json' }, // internal project reference in a nested directory
              { path: './nested-project/tsconfig.json' }, // external project reference in a nested directory
              { path: '../other-lib' }, // external project reference outside of the project root
            ],
          }),
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outFile: '../../dist/libs/my-lib/lib.js' },
            files: ['main.ts'],
          }),
          'libs/my-lib/tsconfig.spec.json': JSON.stringify({
            compilerOptions: { outDir: '../../dist/out-tsc/libs/my-lib/specs' },
            include: ['src/**/*.spec.ts'],
            references: [{ path: './tsconfig.lib.json' }],
          }),
          'libs/my-lib/cypress/tsconfig.json': JSON.stringify({
            compilerOptions: {
              outDir: '../../../dist/out-tsc/libs/my-lib/cypress',
            },
            references: [{ path: '../tsconfig.lib.json' }],
          }),
          'libs/my-lib/package.json': `{}`,
          'libs/my-lib/nested-project/package.json': `{}`,
          'libs/my-lib/nested-project/tsconfig.json': JSON.stringify({
            compilerOptions: {
              outDir: '../../../dist/out-tsc/libs/my-lib/nested-project', // different outDir that should not be included in my-lib because it's an external project reference
            },
          }),
          'libs/other-lib/tsconfig.json': JSON.stringify({
            compilerOptions: {
              outDir: '../../dist/out-tsc/libs/other-lib', // different outDir that should not be included because it's an external project
            },
          }),
        });
        expect(await invokeCreateNodesOnMatchingFiles(context, {}))
          .toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{projectRoot}/tsconfig.json",
                      "{projectRoot}/tsconfig.lib.json",
                      "{projectRoot}/tsconfig.spec.json",
                      "{projectRoot}/cypress/tsconfig.json",
                      "{projectRoot}/src/**/*.spec.ts",
                      {
                        "dependentTasksOutputFiles": "**/*.d.ts",
                      },
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{workspaceRoot}/dist/libs/my-lib/lib.js",
                      "{workspaceRoot}/dist/libs/my-lib/lib.js.map",
                      "{workspaceRoot}/dist/libs/my-lib/lib.d.ts",
                      "{workspaceRoot}/dist/libs/my-lib/lib.d.ts.map",
                      "{workspaceRoot}/dist/libs/my-lib/lib.tsbuildinfo",
                      "{workspaceRoot}/dist/out-tsc/libs/my-lib/specs/**/*.d.ts",
                      "{workspaceRoot}/dist/out-tsc/libs/my-lib/specs/tsconfig.tsbuildinfo",
                      "{workspaceRoot}/dist/out-tsc/libs/my-lib/cypress/**/*.d.ts",
                      "{workspaceRoot}/dist/out-tsc/libs/my-lib/cypress/tsconfig.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
              "libs/my-lib/nested-project": {
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib/nested-project",
                    },
                    "outputs": [
                      "{workspaceRoot}/dist/out-tsc/libs/my-lib/nested-project/**/*.d.ts",
                      "{workspaceRoot}/dist/out-tsc/libs/my-lib/nested-project/tsconfig.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should respect the "tsBuildInfoFile" option', async () => {
        // outFile
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            compilerOptions: {
              outFile: '../../dist/libs/my-lib/index.js',
              tsBuildInfoFile: '../../dist/libs/my-lib/my-lib.tsbuildinfo',
            },
            files: ['main.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });
        expect(await invokeCreateNodesOnMatchingFiles(context, {}))
          .toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{workspaceRoot}/dist/libs/my-lib/index.js",
                      "{workspaceRoot}/dist/libs/my-lib/index.js.map",
                      "{workspaceRoot}/dist/libs/my-lib/index.d.ts",
                      "{workspaceRoot}/dist/libs/my-lib/index.d.ts.map",
                      "{workspaceRoot}/dist/libs/my-lib/my-lib.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);

        // no outFile & no outDir
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            compilerOptions: {
              tsBuildInfoFile: '../../dist/libs/my-lib/my-lib.tsbuildinfo',
            },
            files: ['main.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });
        expect(await invokeCreateNodesOnMatchingFiles(context, {}))
          .toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/**/*.js",
                      "{projectRoot}/**/*.cjs",
                      "{projectRoot}/**/*.mjs",
                      "{projectRoot}/**/*.jsx",
                      "{projectRoot}/**/*.js.map",
                      "{projectRoot}/**/*.jsx.map",
                      "{projectRoot}/**/*.d.ts",
                      "{projectRoot}/**/*.d.cts",
                      "{projectRoot}/**/*.d.mts",
                      "{projectRoot}/**/*.d.ts.map",
                      "{projectRoot}/**/*.d.cts.map",
                      "{projectRoot}/**/*.d.mts.map",
                      "{workspaceRoot}/dist/libs/my-lib/my-lib.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should set the "tsBuildInfoFile" option when outside of the "outDir"', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            compilerOptions: {
              outDir: 'dist',
              tsBuildInfoFile: 'my-lib.tsbuildinfo',
            },
            files: ['main.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });

        expect(await invokeCreateNodesOnMatchingFiles(context, {}))
          .toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist/**/*.d.ts",
                      "{projectRoot}/my-lib.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should not set the "tsBuildInfoFile" option when contained in the "outDir"', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            compilerOptions: {
              outDir: 'dist',
              tsBuildInfoFile: 'dist/my-lib.tsbuildinfo',
            },
            files: ['main.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });

        expect(await invokeCreateNodesOnMatchingFiles(context, {}))
          .toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist/**/*.d.ts",
                      "{projectRoot}/dist/my-lib.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should support the "${configDir}" template', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            compilerOptions: { outDir: '${configDir}/dist' },
            files: ['main.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });
        expect(await invokeCreateNodesOnMatchingFiles(context, {}))
          .toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Runs type-checking for the project.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist/**/*.d.ts",
                      "{projectRoot}/dist/tsconfig.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });
    });
  });

  describe('build target', () => {
    it('should not create a node with a build target for a project level tsconfig files by default', async () => {
      // Sibling package.json
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{"compilerOptions": {"outDir": "dist"}}`,
        'libs/my-lib/tsconfig.build.json': `{}`,
        'libs/my-lib/package.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          // Reduce noise in build snapshots by disabling default typecheck target
          typecheck: false,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {},
            },
          },
        }
      `);

      // Sibling project.json
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{}`,
        'libs/my-lib/tsconfig.build.json': `{}`,
        'libs/my-lib/project.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          // Reduce noise in build snapshots by disabling default typecheck target
          typecheck: false,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {},
            },
          },
        }
      `);
    });

    it('should not create build target for a project level tsconfig.json file if set to false in plugin options', async () => {
      // Sibling package.json
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{"compilerOptions": {"outDir": "dist"}}`,
        'libs/my-lib/tsconfig.build.json': `{}`,
        'libs/my-lib/package.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          // Reduce noise in build snapshots by disabling default typecheck target
          typecheck: false,
          build: false,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {},
            },
          },
        }
      `);

      // Sibling project.json
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{}`,
        'libs/my-lib/tsconfig.build.json': `{}`,
        'libs/my-lib/project.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          // Reduce noise in build snapshots by disabling default typecheck target
          typecheck: false,
          build: false,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {},
            },
          },
        }
      `);
    });

    it('should not create build target when the entry points point to source files', async () => {
      // Sibling package.json
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{"compilerOptions": {"outDir": "dist"}}`,
        'libs/my-lib/package.json': JSON.stringify({
          exports: {
            '.': {
              default: './src/index.ts',
            },
          },
        }),
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          // Reduce noise in build snapshots by disabling default typecheck target
          typecheck: false,
          build: true,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {},
            },
          },
        }
      `);
    });

    it('should create build target when the entry points point to dist files', async () => {
      // Sibling package.json
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{"compilerOptions": {"outDir": "dist"}}`,
        'libs/my-lib/package.json': JSON.stringify({
          exports: {
            '.': {
              // should ignore the fact that the development condition points to source
              development: './src/index.ts',
              types: './dist/index.d.ts',
              default: './dist/index.js',
            },
          },
        }),
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          // Reduce noise in build snapshots by disabling default typecheck target
          typecheck: false,
          build: true,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "build": {
                  "cache": true,
                  "command": "tsc --build tsconfig.lib.json",
                  "dependsOn": [
                    "^build",
                  ],
                  "inputs": [
                    "production",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Builds the project with \`tsc\`.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [
                    "{projectRoot}/dist",
                  ],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should create a node with a build target when enabled, for a project level tsconfig.lib.json build file by default', async () => {
      // Sibling package.json
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{"compilerOptions": {"outDir": "dist"}}`,
        'libs/my-lib/tsconfig.build.json': `{}`,
        'libs/my-lib/package.json': JSON.stringify({
          name: 'my-lib',
          main: 'dist/index.js',
          types: 'dist/index.d.ts',
          exports: {
            '.': {
              types: './dist/index.d.ts',
              import: './dist/index.js',
              default: './dist/index.js',
            },
            './package.json': './package.json',
          },
        }),
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          // Reduce noise in build snapshots by disabling default typecheck target
          typecheck: false,
          build: true, // shorthand for apply with default options
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "build": {
                  "cache": true,
                  "command": "tsc --build tsconfig.lib.json",
                  "dependsOn": [
                    "^build",
                  ],
                  "inputs": [
                    "production",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Builds the project with \`tsc\`.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [
                    "{projectRoot}/dist",
                  ],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
                "build-deps": {
                  "dependsOn": [
                    "^build",
                  ],
                },
                "watch-deps": {
                  "command": "npx nx watch --projects my-lib --includeDependentProjects -- npx nx build-deps my-lib",
                  "continuous": true,
                  "dependsOn": [
                    "build-deps",
                  ],
                },
              },
            },
          },
        }
      `);

      // Sibling project.json
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{"compilerOptions": {"outDir": "dist"}}`,
        'libs/my-lib/tsconfig.build.json': `{}`,
        'libs/my-lib/project.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          // Reduce noise in build snapshots by disabling default typecheck target
          typecheck: false,
          build: {}, // apply with default options
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "build": {
                  "cache": true,
                  "command": "tsc --build tsconfig.lib.json",
                  "dependsOn": [
                    "^build",
                  ],
                  "inputs": [
                    "production",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Builds the project with \`tsc\`.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [
                    "{projectRoot}/dist",
                  ],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should create a node with a build target with "--verbose" flag when the "verboseOutput" plugin option is true', async () => {
      // Sibling package.json
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{"compilerOptions": {"outDir": "dist"}}`,
        'libs/my-lib/tsconfig.build.json': `{}`,
        'libs/my-lib/package.json': JSON.stringify({
          name: 'my-lib',
          main: 'dist/index.js',
          types: 'dist/index.d.ts',
          exports: {
            '.': {
              types: './dist/index.d.ts',
              import: './dist/index.js',
              default: './dist/index.js',
            },
            './package.json': './package.json',
          },
        }),
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          // Reduce noise in build snapshots by disabling default typecheck target
          typecheck: false,
          build: true, // shorthand for apply with default options
          verboseOutput: true,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "build": {
                  "cache": true,
                  "command": "tsc --build tsconfig.lib.json --verbose",
                  "dependsOn": [
                    "^build",
                  ],
                  "inputs": [
                    "production",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Builds the project with \`tsc\`.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [
                    "{projectRoot}/dist",
                  ],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
                "build-deps": {
                  "dependsOn": [
                    "^build",
                  ],
                },
                "watch-deps": {
                  "command": "npx nx watch --projects my-lib --includeDependentProjects -- npx nx build-deps my-lib",
                  "continuous": true,
                  "dependsOn": [
                    "build-deps",
                  ],
                },
              },
            },
          },
        }
      `);

      // Sibling project.json
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{"compilerOptions": {"outDir": "dist"}}`,
        'libs/my-lib/tsconfig.build.json': `{}`,
        'libs/my-lib/project.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          // Reduce noise in build snapshots by disabling default typecheck target
          typecheck: false,
          build: {}, // apply with default options
          verboseOutput: true,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "build": {
                  "cache": true,
                  "command": "tsc --build tsconfig.lib.json --verbose",
                  "dependsOn": [
                    "^build",
                  ],
                  "inputs": [
                    "production",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Builds the project with \`tsc\`.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [
                    "{projectRoot}/dist",
                  ],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should create a node with a build target when enabled, using a custom configured target name', async () => {
      // Sibling package.json
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{"compilerOptions": {"outDir": "dist"}}`,
        'libs/my-lib/tsconfig.build.json': `{}`,
        'libs/my-lib/package.json': `{ "main": "dist/index.js" }`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          // Reduce noise in build snapshots by disabling default typecheck target
          typecheck: false,
          build: {
            targetName: 'my-build',
          },
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "my-build": {
                  "cache": true,
                  "command": "tsc --build tsconfig.lib.json",
                  "dependsOn": [
                    "^my-build",
                  ],
                  "inputs": [
                    "production",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Builds the project with \`tsc\`.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [
                    "{projectRoot}/dist",
                  ],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should create a node with a build target when enabled, using a custom configured tsconfig file', async () => {
      // Sibling project.json
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{}`,
        'libs/my-lib/tsconfig.build.json': `{"compilerOptions": {"outDir": "dist"}}`,
        'libs/my-lib/project.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          // Reduce noise in build snapshots by disabling default typecheck target
          typecheck: false,
          build: {
            configName: 'tsconfig.build.json',
          },
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "build": {
                  "cache": true,
                  "command": "tsc --build tsconfig.build.json",
                  "dependsOn": [
                    "^build",
                  ],
                  "inputs": [
                    "production",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Builds the project with \`tsc\`.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [
                    "{projectRoot}/dist",
                  ],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should handle ts project references pointing to non-existing files and not throw', async () => {
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': JSON.stringify({
          references: [{ path: '../my-lib-2' }],
        }),
        'libs/my-lib/tsconfig.lib.json': `{}`,
        'libs/my-lib/package.json': `{}`,
      });

      await expect(
        invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        })
      ).resolves.not.toThrow();
    });

    describe('inputs', () => {
      it('should add the config file and the `include` and `exclude` patterns', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: {
              outDir: 'dist',
            },
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.spec.ts'],
          }),
          'libs/my-lib/tsconfig.json': `{}`,
          'libs/my-lib/package.json': `{"main": "dist/index.js"}`,
        });
        expect(
          await invokeCreateNodesOnMatchingFiles(context, {
            typecheck: false,
            build: true,
          })
        ).toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{projectRoot}/tsconfig.lib.json",
                      "{projectRoot}/src/**/*.ts",
                      "!{projectRoot}/src/**/*.spec.ts",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Builds the project with \`tsc\`.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should add the config file and the `include` and `exclude` patterns using the "${configDir}" template', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: {
              outDir: 'dist',
            },
            include: ['${configDir}/src/**/*.ts'],
            exclude: ['${configDir}/src/**/*.spec.ts'],
          }),
          'libs/my-lib/tsconfig.json': `{}`,
          'libs/my-lib/package.json': `{"main": "./dist/index.js"}`,
        });
        expect(
          await invokeCreateNodesOnMatchingFiles(context, {
            typecheck: false,
            build: true,
          })
        ).toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{projectRoot}/tsconfig.lib.json",
                      "{projectRoot}/src/**/*.ts",
                      "!{projectRoot}/src/**/*.spec.ts",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Builds the project with \`tsc\`.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should normalize and add directories in `include` with the ts extensions', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist' },
            include: ['src'],
          }),
          'libs/my-lib/tsconfig.json': `{}`,
          'libs/my-lib/package.json': `{"main": "dist/index.js"}`,
        });

        expect(
          await invokeCreateNodesOnMatchingFiles(context, {
            typecheck: false,
            build: true,
          })
        ).toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{projectRoot}/tsconfig.lib.json",
                      "{projectRoot}/src/**/*.ts",
                      "{projectRoot}/src/**/*.tsx",
                      "{projectRoot}/src/**/*.d.ts",
                      "{projectRoot}/src/**/*.cts",
                      "{projectRoot}/src/**/*.d.cts",
                      "{projectRoot}/src/**/*.mts",
                      "{projectRoot}/src/**/*.d.mts",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Builds the project with \`tsc\`.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should normalize and add directories in `include` with the ts and js extensions when `allowJs` is true', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist', allowJs: true },
            include: ['src'],
          }),
          'libs/my-lib/tsconfig.json': `{}`,
          'libs/my-lib/package.json': `{"main": "dist/index.js"}`,
        });

        expect(
          await invokeCreateNodesOnMatchingFiles(context, {
            typecheck: false,
            build: true,
          })
        ).toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{projectRoot}/tsconfig.lib.json",
                      "{projectRoot}/src/**/*.ts",
                      "{projectRoot}/src/**/*.tsx",
                      "{projectRoot}/src/**/*.d.ts",
                      "{projectRoot}/src/**/*.js",
                      "{projectRoot}/src/**/*.jsx",
                      "{projectRoot}/src/**/*.cts",
                      "{projectRoot}/src/**/*.d.cts",
                      "{projectRoot}/src/**/*.cjs",
                      "{projectRoot}/src/**/*.mts",
                      "{projectRoot}/src/**/*.d.mts",
                      "{projectRoot}/src/**/*.mjs",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Builds the project with \`tsc\`.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should normalize and add directories in `include` with the ts and json extensions when `resolveJsonModule` is true', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist', resolveJsonModule: true },
            include: ['src'],
          }),
          'libs/my-lib/tsconfig.json': `{}`,
          'libs/my-lib/package.json': `{"main": "dist/index.js"}`,
        });

        expect(
          await invokeCreateNodesOnMatchingFiles(context, {
            typecheck: false,
            build: true,
          })
        ).toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{projectRoot}/tsconfig.lib.json",
                      "{projectRoot}/src/**/*.ts",
                      "{projectRoot}/src/**/*.tsx",
                      "{projectRoot}/src/**/*.d.ts",
                      "{projectRoot}/src/**/*.cts",
                      "{projectRoot}/src/**/*.d.cts",
                      "{projectRoot}/src/**/*.mts",
                      "{projectRoot}/src/**/*.d.mts",
                      "{projectRoot}/src/**/*.json",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Builds the project with \`tsc\`.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should normalize and add directories in `include` with the ts, js and json extensions when `allowJs` and `resolveJsonModule` are true', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: {
              outDir: 'dist',
              allowJs: true,
              resolveJsonModule: true,
            },
            include: ['src'],
          }),
          'libs/my-lib/tsconfig.json': `{}`,
          'libs/my-lib/package.json': `{"main": "dist/index.js"}`,
        });

        expect(
          await invokeCreateNodesOnMatchingFiles(context, {
            typecheck: false,
            build: true,
          })
        ).toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{projectRoot}/tsconfig.lib.json",
                      "{projectRoot}/src/**/*.ts",
                      "{projectRoot}/src/**/*.tsx",
                      "{projectRoot}/src/**/*.d.ts",
                      "{projectRoot}/src/**/*.js",
                      "{projectRoot}/src/**/*.jsx",
                      "{projectRoot}/src/**/*.cts",
                      "{projectRoot}/src/**/*.d.cts",
                      "{projectRoot}/src/**/*.cjs",
                      "{projectRoot}/src/**/*.mts",
                      "{projectRoot}/src/**/*.d.mts",
                      "{projectRoot}/src/**/*.mjs",
                      "{projectRoot}/src/**/*.json",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Builds the project with \`tsc\`.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should be able to extended config files', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'tsconfig.base.json': JSON.stringify({
            exclude: ['node_modules', 'tmp'],
          }),
          'tsconfig.foo.json': JSON.stringify({
            extends: './tsconfig.base.json',
          }),
          'libs/my-lib/tsconfig.json': '{}',
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            extends: '../../tsconfig.foo.json',
            include: ['src/**/*.ts'],
            compilerOptions: {
              outDir: 'dist',
            },
          }),
          'libs/my-lib/package.json': `{"main": "dist/index.js"}`,
        });
        expect(
          await invokeCreateNodesOnMatchingFiles(context, {
            typecheck: false,
            build: true,
          })
        ).toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{workspaceRoot}/tsconfig.foo.json",
                      "{workspaceRoot}/tsconfig.base.json",
                      "{projectRoot}/tsconfig.lib.json",
                      "{projectRoot}/src/**/*.ts",
                      "!{workspaceRoot}/node_modules",
                      "!{workspaceRoot}/tmp",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Builds the project with \`tsc\`.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should add extended config files when there are multiple extended config files', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'tsconfig.base.json': JSON.stringify({
            exclude: ['node_modules', 'tmp'],
          }),
          'tsconfig.foo.json': '{}',
          'tsconfig.bar.json': JSON.stringify({
            extends: './tsconfig.foo.json',
            exclude: ['node_modules', 'dist'], // extended last, it will override the base config
          }),
          'libs/my-lib/tsconfig.json': '{}',
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            extends: ['../../tsconfig.base.json', '../../tsconfig.bar.json'], // should collect both and any recursive extended configs as inputs
            include: ['src/**/*.ts'],
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/package.json': `{"main": "dist/index.js"}`,
        });
        expect(
          await invokeCreateNodesOnMatchingFiles(context, {
            typecheck: false,
            build: true,
          })
        ).toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{workspaceRoot}/tsconfig.base.json",
                      "{workspaceRoot}/tsconfig.bar.json",
                      "{workspaceRoot}/tsconfig.foo.json",
                      "{projectRoot}/tsconfig.lib.json",
                      "{projectRoot}/src/**/*.ts",
                      "!{workspaceRoot}/node_modules",
                      "!{workspaceRoot}/dist",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Builds the project with \`tsc\`.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should add extended config files supporting node.js style resolution and local workspace packages', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'tsconfig.base.json': JSON.stringify({
            extends: '@tsconfig/strictest/tsconfig.json', // should be resolved and the package name should be included in inputs as an external dependency
            exclude: ['node_modules', 'tmp'],
          }),
          'tsconfig.foo.json': JSON.stringify({
            extends: './tsconfig.base', // extensionless relative path
          }),
          'libs/my-lib/tsconfig.json': '{}',
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            extends: [
              '../../tsconfig.foo.json',
              '@my-org/my-package/tsconfig.base.json', // should be resolved and the path should be included in inputs
            ],
            compilerOptions: {
              outDir: 'dist',
            },
            include: ['src/**/*.ts'],
          }),
          'libs/my-lib/package.json': `{"main": "dist/index.js"}`,
          'libs/my-package/package.json': `{}`,
          'libs/my-package/tsconfig.base.json': `{}`,
          // simulate @tsconfig/strictest package
          'node_modules/@tsconfig/strictest/tsconfig.json': '{}',
        });
        // create a symlink to simulate a local workspace package linked by a package manager
        tempFs.createSymlinkSync(
          'libs/my-package',
          'node_modules/@my-org/my-package',
          'dir'
        );

        expect(
          await invokeCreateNodesOnMatchingFiles(context, {
            typecheck: false,
            build: true,
          })
        ).toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{workspaceRoot}/tsconfig.foo.json",
                      "{workspaceRoot}/tsconfig.base.json",
                      "{workspaceRoot}/libs/my-package/tsconfig.base.json",
                      "{projectRoot}/tsconfig.lib.json",
                      "{projectRoot}/src/**/*.ts",
                      "!{workspaceRoot}/node_modules",
                      "!{workspaceRoot}/tmp",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                          "@tsconfig/strictest",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Builds the project with \`tsc\`.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should add files from internal project references', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': '{}',
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist' },
            include: ['src/**/*.ts'],
            exclude: ['src/**/foo.ts'], // should be ignored because a referenced internal project includes this same pattern
            references: [
              { path: './tsconfig.other.json' },
              { path: '../other-lib' }, // external project reference, it causes `dependentTasksOutputFiles` to be set
            ],
          }),
          'libs/my-lib/tsconfig.other.json': JSON.stringify({
            include: ['other/**/*.ts', 'src/**/foo.ts'],
            // set this to keep outputs smaller
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/other-lib/tsconfig.json': JSON.stringify({
            include: ['**/*.ts'], // different pattern that should not be included because it's an external project
          }),
          'libs/my-lib/package.json': `{"main": "dist/index.js"}`, // Should be defined so that the project is considered buildable
        });
        expect(
          await invokeCreateNodesOnMatchingFiles(context, {
            typecheck: false,
            build: true,
          })
        ).toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{projectRoot}/tsconfig.lib.json",
                      "{projectRoot}/tsconfig.other.json",
                      "{projectRoot}/src/**/*.ts",
                      "{projectRoot}/other/**/*.ts",
                      "{projectRoot}/src/**/foo.ts",
                      {
                        "dependentTasksOutputFiles": "**/*.d.ts",
                      },
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Builds the project with \`tsc\`.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should normalize and add directories in `include` from internal project references', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': '{}',
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist' },
            include: ['src/**/*.ts'],
            exclude: ['src/**/foo.ts'], // should be ignored because a referenced internal project includes this same pattern
            references: [{ path: './tsconfig.other.json' }],
          }),
          'libs/my-lib/tsconfig.other.json': JSON.stringify({
            include: ['other', 'src/**/foo.ts'],
            compilerOptions: {
              outDir: 'dist', // set this to keep outputs smaller
              resolveJsonModule: true, // should result in including json extensions in the normalized include paths
            },
          }),
          'libs/my-lib/package.json': `{"main": "dist/index.js"}`, // Should be defined so that the project is considered buildable
        });

        expect(
          await invokeCreateNodesOnMatchingFiles(context, {
            typecheck: false,
            build: true,
          })
        ).toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{projectRoot}/tsconfig.lib.json",
                      "{projectRoot}/tsconfig.other.json",
                      "{projectRoot}/src/**/*.ts",
                      "{projectRoot}/other/**/*.ts",
                      "{projectRoot}/other/**/*.tsx",
                      "{projectRoot}/other/**/*.d.ts",
                      "{projectRoot}/other/**/*.cts",
                      "{projectRoot}/other/**/*.d.cts",
                      "{projectRoot}/other/**/*.mts",
                      "{projectRoot}/other/**/*.d.mts",
                      "{projectRoot}/other/**/*.json",
                      "{projectRoot}/src/**/foo.ts",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Builds the project with \`tsc\`.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should only add exclude paths that are not part of other tsconfig files include paths', async () => {
        // exact match
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': '{}',
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist' }, // outDir is required to determine if the project is buildable
            include: ['src/**/*.ts'],
            exclude: ['src/**/foo.ts'], // should be ignored
            references: [{ path: './tsconfig.other.json' }],
          }),
          'libs/my-lib/tsconfig.other.json': JSON.stringify({
            include: ['other/**/*.ts', 'src/**/foo.ts'],
          }),
          'libs/my-lib/package.json': `{"main": "dist/index.js" }`,
        });

        let result = await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        });
        expect(result.projects['libs/my-lib'].targets.build.inputs)
          .toMatchInlineSnapshot(`
          [
            "{projectRoot}/package.json",
            "{projectRoot}/tsconfig.lib.json",
            "{projectRoot}/tsconfig.other.json",
            "{projectRoot}/src/**/*.ts",
            "{projectRoot}/other/**/*.ts",
            "{projectRoot}/src/**/foo.ts",
            "^production",
            {
              "externalDependencies": [
                "typescript",
              ],
            },
          ]
        `);

        // other file include pattern is a subset of exclude pattern
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': '{}',
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist' },
            include: ['**/*.ts'],
            exclude: ['**/foo.ts'], // should be ignored
            references: [{ path: './tsconfig.other.json' }],
          }),
          'libs/my-lib/tsconfig.other.json': JSON.stringify({
            include: ['other/**/*.ts', 'src/**/foo.ts'],
          }),
          'libs/my-lib/package.json': `{"main": "dist/index.js"}`,
        });
        result = await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        });
        expect(result.projects['libs/my-lib'].targets.build.inputs)
          .toMatchInlineSnapshot(`
          [
            "{projectRoot}/package.json",
            "{projectRoot}/tsconfig.lib.json",
            "{projectRoot}/tsconfig.other.json",
            "{projectRoot}/**/*.ts",
            "{projectRoot}/other/**/*.ts",
            "{projectRoot}/src/**/foo.ts",
            "^production",
            {
              "externalDependencies": [
                "typescript",
              ],
            },
          ]
        `);

        // exclude pattern is a subset of other file include pattern
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': '{}',
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist' }, // outDir is required to determine if the project is buildable
            include: ['src/**/*.ts'],
            exclude: ['src/**/foo.ts'], // should be ignored
            references: [{ path: './tsconfig.other.json' }],
          }),
          'libs/my-lib/tsconfig.other.json': JSON.stringify({
            include: ['other/**/*.ts', '**/foo.ts'],
          }),
          'libs/my-lib/package.json': `{"main": "dist/index.js" }`, // Should be defined so that the project is considered buildable
        });
        result = await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        });
        expect(result.projects['libs/my-lib'].targets.build.inputs)
          .toMatchInlineSnapshot(`
          [
            "{projectRoot}/package.json",
            "{projectRoot}/tsconfig.lib.json",
            "{projectRoot}/tsconfig.other.json",
            "{projectRoot}/src/**/*.ts",
            "{projectRoot}/other/**/*.ts",
            "{projectRoot}/**/foo.ts",
            "^production",
            {
              "externalDependencies": [
                "typescript",
              ],
            },
          ]
        `);

        // handles mismatches with leading `./`
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': '{}',
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist' },
            include: ['src/**/*.ts'],
            exclude: ['src/**/foo.ts'], // should be ignored
            references: [{ path: './tsconfig.other.json' }],
          }),
          'libs/my-lib/tsconfig.other.json': JSON.stringify({
            include: ['./other/**/*.ts', './**/foo.ts'],
          }),
          'libs/my-lib/package.json': `{"main": "dist/index.js" }`,
        });
        result = await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        });
        expect(result.projects['libs/my-lib'].targets.build.inputs)
          .toMatchInlineSnapshot(`
          [
            "{projectRoot}/package.json",
            "{projectRoot}/tsconfig.lib.json",
            "{projectRoot}/tsconfig.other.json",
            "{projectRoot}/src/**/*.ts",
            "{projectRoot}/other/**/*.ts",
            "{projectRoot}/**/foo.ts",
            "^production",
            {
              "externalDependencies": [
                "typescript",
              ],
            },
          ]
        `);

        // no matching pattern in the exclude list
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': '{}',
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist' },
            include: ['src/**/*.ts'],
            exclude: [
              'src/**/foo.ts', // should be ignored
              'src/**/bar.ts', // should be added to inputs as a negative pattern
            ],
            references: [{ path: './tsconfig.other.json' }],
          }),
          'libs/my-lib/tsconfig.other.json': JSON.stringify({
            include: ['other/**/*.ts', 'src/**/foo.ts'],
          }),
          'libs/my-lib/package.json': `{"main": "dist/index.js" }`,
        });
        result = await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        });
        expect(result.projects['libs/my-lib'].targets.build.inputs)
          .toMatchInlineSnapshot(`
          [
            "{projectRoot}/package.json",
            "{projectRoot}/tsconfig.lib.json",
            "{projectRoot}/tsconfig.other.json",
            "{projectRoot}/src/**/*.ts",
            "{projectRoot}/other/**/*.ts",
            "{projectRoot}/src/**/foo.ts",
            "!{projectRoot}/src/**/bar.ts",
            "^production",
            {
              "externalDependencies": [
                "typescript",
              ],
            },
          ]
        `);
      });

      it('should fall back to named inputs when not using include', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist' },
            files: ['main.ts'],
          }),
          'libs/my-lib/tsconfig.json': `{}`,
          'libs/my-lib/package.json': `{"main": "dist/index.js"}`,
        });
        expect(
          await invokeCreateNodesOnMatchingFiles(context, {
            typecheck: false,
            build: true,
          })
        ).toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Builds the project with \`tsc\`.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });
    });

    describe('outputs', () => {
      it('should add the `outFile`', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: {
              outFile: '../../dist/libs/my-lib/index.js',
            },
            files: ['main.ts'],
          }),
          'libs/my-lib/tsconfig.json': `{}`,
          'libs/my-lib/package.json': `{}`,
        });
        expect(
          await invokeCreateNodesOnMatchingFiles(context, {
            typecheck: false,
            build: true,
          })
        ).toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Builds the project with \`tsc\`.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{workspaceRoot}/dist/libs/my-lib/index.js",
                      "{workspaceRoot}/dist/libs/my-lib/index.js.map",
                      "{workspaceRoot}/dist/libs/my-lib/index.d.ts",
                      "{workspaceRoot}/dist/libs/my-lib/index.d.ts.map",
                      "{workspaceRoot}/dist/libs/my-lib/index.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should add the `outDir`', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: {
              outDir: '../../dist/libs/my-lib',
            },
            files: ['main.ts'],
          }),
          'libs/my-lib/tsconfig.json': `{}`,
          'libs/my-lib/package.json': `{"main": "../../dist/libs/my-lib/index.js"}`,
        });
        expect(
          await invokeCreateNodesOnMatchingFiles(context, {
            typecheck: false,
            build: true,
          })
        ).toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Builds the project with \`tsc\`.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{workspaceRoot}/dist/libs/my-lib",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should add the inline output files when `outDir` is not defined', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            files: ['main.ts'],
          }),
          'libs/my-lib/tsconfig.json': `{}`,
          'libs/my-lib/package.json': `{}`,
        });
        expect(
          await invokeCreateNodesOnMatchingFiles(context, {
            typecheck: false,
            build: true,
          })
        ).toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Builds the project with \`tsc\`.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/**/*.js",
                      "{projectRoot}/**/*.cjs",
                      "{projectRoot}/**/*.mjs",
                      "{projectRoot}/**/*.jsx",
                      "{projectRoot}/**/*.js.map",
                      "{projectRoot}/**/*.jsx.map",
                      "{projectRoot}/**/*.d.ts",
                      "{projectRoot}/**/*.d.cts",
                      "{projectRoot}/**/*.d.mts",
                      "{projectRoot}/**/*.d.ts.map",
                      "{projectRoot}/**/*.d.cts.map",
                      "{projectRoot}/**/*.d.mts.map",
                      "{projectRoot}/tsconfig.lib.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should collect outputs from all internal project references', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': '{}',
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: {
              outFile: '../../dist/libs/my-lib/lib.js',
            },
            files: ['main.ts'],
            references: [{ path: './tsconfig.other.json' }],
          }),
          'libs/my-lib/tsconfig.other.json': JSON.stringify({
            compilerOptions: {
              outDir: '../../dist/libs/my-lib/other',
            },
            include: ['other/**/*.ts'],
          }),
          'libs/my-lib/package.json': `{"main": "../../dist/libs/my-lib/lib.js"}`,
        });
        expect(
          await invokeCreateNodesOnMatchingFiles(context, {
            typecheck: false,
            build: true,
          })
        ).toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "{projectRoot}/package.json",
                      "{projectRoot}/tsconfig.lib.json",
                      "{projectRoot}/tsconfig.other.json",
                      "{projectRoot}/other/**/*.ts",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Builds the project with \`tsc\`.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{workspaceRoot}/dist/libs/my-lib/lib.js",
                      "{workspaceRoot}/dist/libs/my-lib/lib.js.map",
                      "{workspaceRoot}/dist/libs/my-lib/lib.d.ts",
                      "{workspaceRoot}/dist/libs/my-lib/lib.d.ts.map",
                      "{workspaceRoot}/dist/libs/my-lib/lib.tsbuildinfo",
                      "{workspaceRoot}/dist/libs/my-lib/other",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should respect the "tsBuildInfoFile" option', async () => {
        // outFile
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': '{}',
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: {
              outFile: '../../dist/libs/my-lib/index.js',
              tsBuildInfoFile: '../../dist/libs/my-lib/my-lib.tsbuildinfo',
            },
            files: ['main.ts'],
          }),
          'libs/my-lib/package.json': `{"main": "../../dist/libs/my-lib/index.js"}`,
        });
        expect(
          await invokeCreateNodesOnMatchingFiles(context, {
            typecheck: false,
            build: true,
          })
        ).toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Builds the project with \`tsc\`.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{workspaceRoot}/dist/libs/my-lib/index.js",
                      "{workspaceRoot}/dist/libs/my-lib/index.js.map",
                      "{workspaceRoot}/dist/libs/my-lib/index.d.ts",
                      "{workspaceRoot}/dist/libs/my-lib/index.d.ts.map",
                      "{workspaceRoot}/dist/libs/my-lib/my-lib.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);

        // no outFile & no outDir
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': '{}',
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: {
              tsBuildInfoFile: '../../dist/libs/my-lib/my-lib.tsbuildinfo',
            },
            files: ['main.ts'],
          }),
          'libs/my-lib/package.json': `{"main": "dist/libs/my-lib/index.js"}`,
        });
        expect(
          await invokeCreateNodesOnMatchingFiles(context, {
            typecheck: false,
            build: true,
          })
        ).toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Builds the project with \`tsc\`.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/**/*.js",
                      "{projectRoot}/**/*.cjs",
                      "{projectRoot}/**/*.mjs",
                      "{projectRoot}/**/*.jsx",
                      "{projectRoot}/**/*.js.map",
                      "{projectRoot}/**/*.jsx.map",
                      "{projectRoot}/**/*.d.ts",
                      "{projectRoot}/**/*.d.cts",
                      "{projectRoot}/**/*.d.mts",
                      "{projectRoot}/**/*.d.ts.map",
                      "{projectRoot}/**/*.d.cts.map",
                      "{projectRoot}/**/*.d.mts.map",
                      "{workspaceRoot}/dist/libs/my-lib/my-lib.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should set the "tsBuildInfoFile" option when outside of the "outDir"', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: {
              outDir: 'dist',
              tsBuildInfoFile: 'my-lib.tsbuildinfo',
            },
            files: ['main.ts'],
          }),
          'libs/my-lib/tsconfig.json': `{}`,
          'libs/my-lib/package.json': `{"main": "dist/index.js"}`,
        });

        expect(
          await invokeCreateNodesOnMatchingFiles(context, {
            typecheck: false,
            build: true,
          })
        ).toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Builds the project with \`tsc\`.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist",
                      "{projectRoot}/my-lib.tsbuildinfo",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should not set the "tsBuildInfoFile" option when contained in the "outDir"', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: {
              outDir: 'dist',
              tsBuildInfoFile: 'dist/my-lib.tsbuildinfo',
            },
            files: ['main.ts'],
          }),
          'libs/my-lib/tsconfig.json': `{}`,
          'libs/my-lib/package.json': `{"main": "dist/index.js"}`,
        });

        expect(
          await invokeCreateNodesOnMatchingFiles(context, {
            typecheck: false,
            build: true,
          })
        ).toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Builds the project with \`tsc\`.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });

      it('should support the "${configDir}" template', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: {
              outDir: '${configDir}/dist',
            },
            files: ['main.ts'],
          }),
          'libs/my-lib/tsconfig.json': `{}`,
          'libs/my-lib/package.json': `{"main": "./dist/index.js"}`,
        });
        expect(
          await invokeCreateNodesOnMatchingFiles(context, {
            typecheck: false,
            build: true,
          })
        ).toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "typescript",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Builds the project with \`tsc\`.",
                      "help": {
                        "command": "npx tsc --build --help",
                        "example": {
                          "args": [
                            "--force",
                          ],
                        },
                      },
                      "technologies": [
                        "typescript",
                      ],
                    },
                    "options": {
                      "cwd": "libs/my-lib",
                    },
                    "outputs": [
                      "{projectRoot}/dist",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
            },
          }
        `);
      });
    });
  });

  describe('isValidPackageJsonBuildConfig', () => {
    it('should consider a package buildable when main points to transpiled output outside source folder', async () => {
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': '{}',
        'libs/my-lib/tsconfig.lib.json': JSON.stringify({
          compilerOptions: { outDir: 'src' },
          include: ['typescript/**/*.ts'],
        }),
        'libs/my-lib/package.json': JSON.stringify({
          main: 'src/index.js',
        }),
        'libs/my-lib/typescript/index.ts': 'export const hello = "world";',
      });

      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "build": {
                  "cache": true,
                  "command": "tsc --build tsconfig.lib.json",
                  "dependsOn": [
                    "^build",
                  ],
                  "inputs": [
                    "{projectRoot}/package.json",
                    "{projectRoot}/tsconfig.lib.json",
                    "{projectRoot}/typescript/**/*.ts",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Builds the project with \`tsc\`.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [
                    "{projectRoot}/src",
                  ],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should consider a package buildable when main points to transpiled output with include patterns', async () => {
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': '{}',
        'libs/my-lib/tsconfig.lib.json': JSON.stringify({
          compilerOptions: { outDir: 'lib' },
          include: ['src/**/*.ts'],
        }),
        'libs/my-lib/package.json': JSON.stringify({
          main: 'lib/index.js',
        }),
        'libs/my-lib/src/index.ts': 'export const hello = "world";',
      });

      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "build": {
                  "cache": true,
                  "command": "tsc --build tsconfig.lib.json",
                  "dependsOn": [
                    "^build",
                  ],
                  "inputs": [
                    "{projectRoot}/package.json",
                    "{projectRoot}/tsconfig.lib.json",
                    "{projectRoot}/src/**/*.ts",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Builds the project with \`tsc\`.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [
                    "{projectRoot}/lib",
                  ],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should not consider a package buildable when main points to source file', async () => {
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': '{}',
        'libs/my-lib/tsconfig.lib.json': JSON.stringify({
          compilerOptions: { outDir: 'dist' },
          include: ['src/**/*.ts'],
        }),
        'libs/my-lib/package.json': JSON.stringify({
          main: 'src/index.ts',
        }),
        'libs/my-lib/src/index.ts': 'export const hello = "world";',
      });

      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {},
            },
          },
        }
      `);
    });

    it('should consider a package buildable when main points to source file when skipBuildCheck is true', async () => {
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': '{}',
        'libs/my-lib/tsconfig.lib.json': JSON.stringify({
          compilerOptions: { outDir: 'dist' },
          include: ['src/**/*.ts'],
        }),
        'libs/my-lib/package.json': JSON.stringify({
          main: 'src/index.ts',
        }),
        'libs/my-lib/src/index.ts': 'export const hello = "world";',
      });

      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: {
            skipBuildCheck: true,
          },
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "build": {
                  "cache": true,
                  "command": "tsc --build tsconfig.lib.json",
                  "dependsOn": [
                    "^build",
                  ],
                  "inputs": [
                    "{projectRoot}/package.json",
                    "{projectRoot}/tsconfig.lib.json",
                    "{projectRoot}/src/**/*.ts",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Builds the project with \`tsc\`.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [
                    "{projectRoot}/dist",
                  ],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should handle relative paths correctly when main points to transpiled output', async () => {
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': '{}',
        'libs/my-lib/tsconfig.lib.json': JSON.stringify({
          compilerOptions: { outDir: '../build/my-lib' },
          include: ['src/**/*.ts'],
        }),
        'libs/my-lib/package.json': JSON.stringify({
          main: '../build/my-lib/index.js',
        }),
        'libs/my-lib/src/index.ts': 'export const hello = "world";',
      });

      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "build": {
                  "cache": true,
                  "command": "tsc --build tsconfig.lib.json",
                  "dependsOn": [
                    "^build",
                  ],
                  "inputs": [
                    "{projectRoot}/package.json",
                    "{projectRoot}/tsconfig.lib.json",
                    "{projectRoot}/src/**/*.ts",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Builds the project with \`tsc\`.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [
                    "{workspaceRoot}/libs/build/my-lib",
                  ],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should handle absolute paths correctly when main points to transpiled output', async () => {
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': '{}',
        'libs/my-lib/tsconfig.lib.json': JSON.stringify({
          compilerOptions: { outDir: 'dist' },
          include: ['source/**/*.ts'],
        }),
        'libs/my-lib/package.json': JSON.stringify({
          main: '/libs/my-lib/dist/index.js',
        }),
        'libs/my-lib/source/index.ts': 'export const hello = "world";',
      });

      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "build": {
                  "cache": true,
                  "command": "tsc --build tsconfig.lib.json",
                  "dependsOn": [
                    "^build",
                  ],
                  "inputs": [
                    "{projectRoot}/package.json",
                    "{projectRoot}/tsconfig.lib.json",
                    "{projectRoot}/source/**/*.ts",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Builds the project with \`tsc\`.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [
                    "{projectRoot}/dist",
                  ],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should not consider package buildable when absolute path points to source file', async () => {
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': '{}',
        'libs/my-lib/tsconfig.lib.json': JSON.stringify({
          compilerOptions: { outDir: 'dist' },
          include: ['src/**/*.ts'],
        }),
        'libs/my-lib/package.json': JSON.stringify({
          main: '/libs/my-lib/src/index.ts',
        }),
        'libs/my-lib/src/index.ts': 'export const hello = "world";',
      });

      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {},
            },
          },
        }
      `);
    });

    it('should handle glob patterns with ** and single *', async () => {
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': '{}',
        'libs/my-lib/tsconfig.lib.json': JSON.stringify({
          compilerOptions: { outDir: 'compiled' },
          include: ['**/src/**/*.ts', 'utils/*.ts'],
        }),
        'libs/my-lib/package.json': JSON.stringify({
          main: 'compiled/index.js',
        }),
        'libs/my-lib/nested/src/index.ts': 'export const hello = "world";',
        'libs/my-lib/utils/helper.ts': 'export const helper = () => {};',
      });

      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "build": {
                  "cache": true,
                  "command": "tsc --build tsconfig.lib.json",
                  "dependsOn": [
                    "^build",
                  ],
                  "inputs": [
                    "{projectRoot}/package.json",
                    "{projectRoot}/tsconfig.lib.json",
                    "{projectRoot}/**/src/**/*.ts",
                    "{projectRoot}/utils/*.ts",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Builds the project with \`tsc\`.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [
                    "{projectRoot}/compiled",
                  ],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should consider package buildable when outDir is outside project and main export points to outDir', async () => {
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': '{}',
        'libs/my-lib/tsconfig.lib.json': JSON.stringify({
          compilerOptions: { outDir: '../../../external-build' },
          include: ['src/**/*.ts'],
        }),
        'libs/my-lib/package.json': JSON.stringify({
          main: '../../../external-build/index.js',
        }),
        'libs/my-lib/src/index.ts': 'export const hello = "world";',
      });

      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "build": {
                  "cache": true,
                  "command": "tsc --build tsconfig.lib.json",
                  "dependsOn": [
                    "^build",
                  ],
                  "inputs": [
                    "{projectRoot}/package.json",
                    "{projectRoot}/tsconfig.lib.json",
                    "{projectRoot}/src/**/*.ts",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Builds the project with \`tsc\`.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [
                    "external-build",
                  ],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should consider package buildable when outDir is within project and main points to file inside outDir', async () => {
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': '{}',
        'libs/my-lib/tsconfig.lib.json': JSON.stringify({
          compilerOptions: { outDir: 'dist' },
          include: ['src/**/*.ts'],
        }),
        'libs/my-lib/package.json': JSON.stringify({
          main: 'dist/index.js',
        }),
        'libs/my-lib/src/index.ts': 'export const hello = "world";',
      });

      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "build": {
                  "cache": true,
                  "command": "tsc --build tsconfig.lib.json",
                  "dependsOn": [
                    "^build",
                  ],
                  "inputs": [
                    "{projectRoot}/package.json",
                    "{projectRoot}/tsconfig.lib.json",
                    "{projectRoot}/src/**/*.ts",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Builds the project with \`tsc\`.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [
                    "{projectRoot}/dist",
                  ],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should not consider package buildable when outDir is within project but main points to source file', async () => {
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': '{}',
        'libs/my-lib/tsconfig.lib.json': JSON.stringify({
          compilerOptions: { outDir: 'dist' },
          include: ['src/**/*.ts'],
        }),
        'libs/my-lib/package.json': JSON.stringify({
          main: 'src/index.ts',
        }),
        'libs/my-lib/src/index.ts': 'export const hello = "world";',
      });

      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {},
            },
          },
        }
      `);
    });

    it('should consider package buildable when main points to JS build output', async () => {
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': '{}',
        'libs/my-lib/tsconfig.lib.json': JSON.stringify({
          compilerOptions: { outDir: 'build' },
        }),
        'libs/my-lib/package.json': JSON.stringify({
          main: 'build/index.js',
        }),
        'libs/my-lib/lib/index.ts': 'export const hello = "world";',
        'libs/my-lib/build/index.js': 'export const hello = "world";',
      });

      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "build": {
                  "cache": true,
                  "command": "tsc --build tsconfig.lib.json",
                  "dependsOn": [
                    "^build",
                  ],
                  "inputs": [
                    "production",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Builds the project with \`tsc\`.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [
                    "{projectRoot}/build",
                  ],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should not consider package buildable when main points to TS source file', async () => {
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': '{}',
        'libs/my-lib/tsconfig.lib.json': JSON.stringify({
          compilerOptions: { outDir: 'build' },
        }),
        'libs/my-lib/package.json': JSON.stringify({
          main: 'lib/index.ts',
        }),
        'libs/my-lib/lib/index.ts': 'export const hello = "world";',
      });

      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {},
            },
          },
        }
      `);
    });

    it('should consider package buildable when main points to build output even with TS extension', async () => {
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': '{}',
        'libs/my-lib/tsconfig.lib.json': JSON.stringify({
          compilerOptions: { outDir: 'build' },
        }),
        'libs/my-lib/package.json': JSON.stringify({
          main: 'build/index.ts',
        }),
        'libs/my-lib/lib/index.ts': 'export const hello = "world";',
        'libs/my-lib/build/index.ts': 'export const hello = "world";',
      });

      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "build": {
                  "cache": true,
                  "command": "tsc --build tsconfig.lib.json",
                  "dependsOn": [
                    "^build",
                  ],
                  "inputs": [
                    "production",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Builds the project with \`tsc\`.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [
                    "{projectRoot}/build",
                  ],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should not consider package buildable when main matches include pattern', async () => {
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': '{}',
        'libs/my-lib/tsconfig.lib.json': JSON.stringify({
          compilerOptions: {},
          include: ['lib/**/*.ts'],
        }),
        'libs/my-lib/package.json': JSON.stringify({
          main: 'lib/index.ts',
        }),
        'libs/my-lib/lib/index.ts': 'export const hello = "world";',
      });

      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {},
            },
          },
        }
      `);
    });

    it('should consider package buildable when main does not match include pattern', async () => {
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': '{}',
        'libs/my-lib/tsconfig.lib.json': JSON.stringify({
          compilerOptions: {},
          include: ['lib/**/*.ts'],
        }),
        'libs/my-lib/package.json': JSON.stringify({
          main: 'generated/index.ts',
        }),
        'libs/my-lib/lib/index.ts': 'export const hello = "world";',
        'libs/my-lib/generated/index.ts': 'export const hello = "world";',
      });

      expect(
        await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "build": {
                  "cache": true,
                  "command": "tsc --build tsconfig.lib.json",
                  "dependsOn": [
                    "^build",
                  ],
                  "inputs": [
                    "{projectRoot}/package.json",
                    "{projectRoot}/tsconfig.lib.json",
                    "{projectRoot}/lib/**/*.ts",
                    "^production",
                    {
                      "externalDependencies": [
                        "typescript",
                      ],
                    },
                  ],
                  "metadata": {
                    "description": "Builds the project with \`tsc\`.",
                    "help": {
                      "command": "npx tsc --build --help",
                      "example": {
                        "args": [
                          "--force",
                        ],
                      },
                    },
                    "technologies": [
                      "typescript",
                    ],
                  },
                  "options": {
                    "cwd": "libs/my-lib",
                  },
                  "outputs": [
                    "{projectRoot}/**/*.js",
                    "{projectRoot}/**/*.cjs",
                    "{projectRoot}/**/*.mjs",
                    "{projectRoot}/**/*.jsx",
                    "{projectRoot}/**/*.js.map",
                    "{projectRoot}/**/*.jsx.map",
                    "{projectRoot}/**/*.d.ts",
                    "{projectRoot}/**/*.d.cts",
                    "{projectRoot}/**/*.d.mts",
                    "{projectRoot}/**/*.d.ts.map",
                    "{projectRoot}/**/*.d.cts.map",
                    "{projectRoot}/**/*.d.mts.map",
                    "{projectRoot}/tsconfig.lib.tsbuildinfo",
                  ],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
              },
            },
          },
        }
      `);
    });
  });
});

async function applyFilesToTempFsAndContext(
  tempFs: TempFs,
  context: CreateNodesContext,
  fileSys: Record<string, string>
) {
  await tempFs.createFiles(fileSys);
  // @ts-expect-error update otherwise readonly property for testing
  context.configFiles = Object.keys(fileSys).filter((file) =>
    picomatch(createNodesV2[0], { dot: true })(file)
  );
  setupWorkspaceContext(tempFs.tempDir);
}

async function invokeCreateNodesOnMatchingFiles(
  context: CreateNodesContext,
  pluginOptions: TscPluginOptions
) {
  const aggregateProjects: Record<string, any> = {};
  const results = await createNodesV2[1](
    context.configFiles,
    pluginOptions,
    context
  );
  for (const [, nodes] of results) {
    for (const [projectName, project] of Object.entries(nodes.projects ?? {})) {
      if (aggregateProjects[projectName]) {
        aggregateProjects[projectName].targets = {
          ...aggregateProjects[projectName].targets,
          ...project.targets,
        };
      } else {
        aggregateProjects[projectName] = project;
      }
    }
  }
  return {
    projects: aggregateProjects,
  };
}
