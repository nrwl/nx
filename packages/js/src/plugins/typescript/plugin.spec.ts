import { detectPackageManager, type CreateNodesContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import picomatch = require('picomatch');
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  getLockFileName,
  matchGlobPaths,
  setupWorkspaceContext,
} from '@nx/devkit/internal';
import type { Mock } from 'vitest';
import { isUsingTsSolutionSetup } from '../../utils/typescript/ts-solution-setup';
import { PLUGIN_NAME, createNodesV2, type TscPluginOptions } from './plugin';

vi.mock('../../utils/typescript/ts-solution-setup', async () => ({
  ...(await vi.importActual<any>('../../utils/typescript/ts-solution-setup')),
  isUsingTsSolutionSetup: vi.fn(),
}));

vi.mock('nx/src/utils/cache-directory', async () => ({
  ...(await vi.importActual<any>('nx/src/utils/cache-directory')),
  workspaceDataDirectory: 'tmp/project-graph-cache',
}));

describe(`Plugin: ${PLUGIN_NAME}`, () => {
  let context: CreateNodesContext;
  let cwd = process.cwd();
  let tempFs: TempFs;
  let originalCacheProjectGraph: string | undefined;
  let lockFileName: string;
  let configFiles: string[];

  beforeEach(async () => {
    (isUsingTsSolutionSetup as Mock).mockReturnValue(true);
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
    };
    process.chdir(tempFs.tempDir);
    originalCacheProjectGraph = process.env.NX_CACHE_PROJECT_GRAPH;
    process.env.NX_CACHE_PROJECT_GRAPH = 'false';
    lockFileName = getLockFileName(detectPackageManager(context.workspaceRoot));
    await applyFilesToTempFsAndContext(tempFs, {
      [lockFileName]: '',
    });
  });

  afterEach(() => {
    vi.resetModules();
    process.chdir(cwd);
    tempFs.cleanup();
    process.env.NX_CACHE_PROJECT_GRAPH = originalCacheProjectGraph;
    rmSync('tmp/project-graph-cache', { recursive: true, force: true });
  });

  it('should handle missing lock file', async () => {
    configFiles = await applyFilesToTempFsAndContext(tempFs, {
      'libs/my-lib/tsconfig.json': JSON.stringify({ files: [] }),
      'libs/my-lib/package.json': `{}`,
    });
    tempFs.removeFileSync(lockFileName);

    await expect(
      invokeCreateNodesOnMatchingFiles(configFiles, context, {})
    ).resolves.not.toThrow();
  });

  it('should not create nodes for root tsconfig.json files', async () => {
    configFiles = await applyFilesToTempFsAndContext(tempFs, {
      'package.json': `{}`,
      'project.json': `{}`,
      'tsconfig.json': `{}`,
      'src/index.ts': `console.log('Hello World!');`,
    });
    expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
      .toMatchInlineSnapshot(`
      {
        "projects": {},
      }
    `);
  });

  describe('typecheck target', () => {
    it('should create a node with a typecheck target for a project level tsconfig.json file by default (when there is a sibling package.json or project.json)', async () => {
      // Sibling package.json
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': JSON.stringify({ files: [] }),
        'libs/my-lib/package.json': `{}`,
      });
      expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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

      // Sibling project.json
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': JSON.stringify({ files: [] }),
        'libs/my-lib/project.json': `{}`,
      });
      expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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

      // Other tsconfigs present
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': JSON.stringify({ files: [] }),
        'libs/my-lib/tsconfig.lib.json': `{}`,
        'libs/my-lib/tsconfig.build.json': `{}`,
        'libs/my-lib/tsconfig.spec.json': `{}`,
        'libs/my-lib/project.json': `{}`,
      });
      expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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

    it('should create a node with a typecheck target with "--verbose" flag when the "verboseOutput" plugin option is true', async () => {
      // Sibling package.json
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': JSON.stringify({ files: [] }),
        'libs/my-lib/package.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
          verboseOutput: true,
        })
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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

      // Sibling project.json
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': JSON.stringify({ files: [] }),
        'libs/my-lib/project.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
          verboseOutput: true,
        })
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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

      // Other tsconfigs present
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': JSON.stringify({ files: [] }),
        'libs/my-lib/tsconfig.lib.json': `{}`,
        'libs/my-lib/tsconfig.build.json': `{}`,
        'libs/my-lib/tsconfig.spec.json': `{}`,
        'libs/my-lib/project.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
          verboseOutput: true,
        })
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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

    it.each([
      [{ compiler: 'tsc; touch pwned #' }, '"compiler"'],
      [
        { typecheck: { configName: 'tsconfig;touch pwned;.json' } },
        '"typecheck.configName"',
      ],
      [
        { build: { configName: 'tsconfig.lib.json $(touch pwned)' } },
        '"build.configName"',
      ],
    ])(
      'should reject %j, which would go into a shell command',
      async (options, option) => {
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': JSON.stringify({ files: [] }),
          'libs/my-lib/package.json': `{}`,
        });

        await expect(
          invokeCreateNodesOnMatchingFiles(
            configFiles,
            context,
            options as TscPluginOptions
          )
        ).rejects.toThrow(option);
      }
    );

    it('should create a typecheck target with custom compiler option (tsgo)', async () => {
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': JSON.stringify({ files: [] }),
        'libs/my-lib/package.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
          compiler: 'tsgo',
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "typecheck": {
                  "cache": true,
                  "command": "tsgo --build --emitDeclarationOnly",
                  "dependsOn": [
                    "^typecheck",
                  ],
                  "inputs": [
                    "production",
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
                    },
                  ],
                  "metadata": {
                    "description": "Runs type-checking for the project.",
                    "help": {
                      "command": "npx tsgo --build --help",
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

    it('should create a typecheck target with custom compiler option (tsgo) and verboseOutput', async () => {
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': JSON.stringify({ files: [] }),
        'libs/my-lib/package.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
          compiler: 'tsgo',
          verboseOutput: true,
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "typecheck": {
                  "cache": true,
                  "command": "tsgo --build --emitDeclarationOnly --verbose",
                  "dependsOn": [
                    "^typecheck",
                  ],
                  "inputs": [
                    "production",
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
                    },
                  ],
                  "metadata": {
                    "description": "Runs type-checking for the project.",
                    "help": {
                      "command": "npx tsgo --build --help",
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

    it('should create a typecheck target with custom compiler option (tsgo) and custom targetName', async () => {
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': JSON.stringify({ files: [] }),
        'libs/my-lib/package.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
          compiler: 'tsgo',
          typecheck: {
            targetName: 'type-check',
          },
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "targets": {
                "type-check": {
                  "cache": true,
                  "command": "tsgo --build --emitDeclarationOnly",
                  "dependsOn": [
                    "^type-check",
                  ],
                  "inputs": [
                    "production",
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
                    },
                  ],
                  "metadata": {
                    "description": "Runs type-checking for the project.",
                    "help": {
                      "command": "npx tsgo --build --help",
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

    it('should create a typecheck target with explicit tsc compiler option', async () => {
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': JSON.stringify({ files: [] }),
        'libs/my-lib/package.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
          compiler: 'tsc',
        })
      ).toMatchInlineSnapshot(`
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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

    it('should create both typecheck and build targets with custom compiler option (tsgo)', async () => {
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': JSON.stringify({ files: [] }),
        'libs/my-lib/tsconfig.lib.json': `{"compilerOptions": {"outDir": "dist"}}`,
        'libs/my-lib/package.json': `{ "main": "dist/index.js" }`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
          compiler: 'tsgo',
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
                  "command": "tsgo --build tsconfig.lib.json",
                  "dependsOn": [
                    "^build",
                  ],
                  "inputs": [
                    "production",
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
                    },
                  ],
                  "metadata": {
                    "description": "Builds the project with \`tsc\`.",
                    "help": {
                      "command": "npx tsgo --build --help",
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
                    "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                    "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
                  ],
                  "syncGenerators": [
                    "@nx/js:typescript-sync",
                  ],
                },
                "typecheck": {
                  "cache": true,
                  "command": "tsgo --build --emitDeclarationOnly",
                  "dependsOn": [
                    "build",
                    "^typecheck",
                  ],
                  "inputs": [
                    "production",
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
                    },
                  ],
                  "metadata": {
                    "description": "Runs type-checking for the project.",
                    "help": {
                      "command": "npx tsgo --build --help",
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

    it('should not create typecheck target for a project level tsconfig.json file if set to false in plugin options', async () => {
      // Sibling package.json
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/package.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/project.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': JSON.stringify({
          compilerOptions: { noEmit: true },
          files: [],
        }),
        'libs/my-lib/package.json': `{}`,
      });
      expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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

      // set in extended tsconfig file
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'tsconfig.base.json': JSON.stringify({
          compilerOptions: { noEmit: true },
        }),
        'libs/my-lib/tsconfig.json': JSON.stringify({
          extends: '../../tsconfig.base.json',
          files: [],
        }),
        'libs/my-lib/package.json': `{}`,
      });
      expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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

    it('should not invoke `tsc --build` when `noEmit` is set in any of the referenced tsconfig.json files', async () => {
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
      expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                    "{projectRoot}/tsconfig.tsbuildinfo",
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

    it('should handle ts project references pointing to non-existing files and not throw', async () => {
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': JSON.stringify({
          references: [{ path: '../my-lib-2' }],
        }),
        'libs/my-lib/package.json': `{}`,
      });

      await expect(
        invokeCreateNodesOnMatchingFiles(configFiles, context, {})
      ).resolves.not.toThrow();
    });

    it('should not infer typecheck target when nx.addTypecheckTarget is false in tsconfig.json', async () => {
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                    "{projectRoot}/out-tsc/my-lib/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                    "{projectRoot}/out-tsc/tsconfig.lib.tsbuildinfo",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            include: ['src/**/*.ts'],
            exclude: ['src/**/foo.ts'],
            // set this to keep outputs smaller
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/package.json': `{}`,
        });
        expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            include: ['${configDir}/src/**/*.ts'],
            exclude: ['${configDir}/src/**/foo.ts'],
            // set this to keep outputs smaller
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/package.json': `{}`,
        });
        expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            include: ['src'],
            // set this to keep outputs smaller
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/package.json': `{}`,
        });

        expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}",
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

      it('should normalize and expand "." in `include` with the ts extensions', async () => {
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            include: ['.'],
            // set this to keep outputs smaller
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/package.json': `{}`,
        });

        expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                      "{projectRoot}/**/*.ts",
                      "{projectRoot}/**/*.tsx",
                      "{projectRoot}/**/*.d.ts",
                      "{projectRoot}/**/*.cts",
                      "{projectRoot}/**/*.d.cts",
                      "{projectRoot}/**/*.mts",
                      "{projectRoot}/**/*.d.mts",
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}",
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

      it('should normalize and expand ".." in `include` with the ts extensions', async () => {
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            include: ['..'],
            // set this to keep outputs smaller
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/package.json': `{}`,
        });

        const result = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          {}
        );
        expect(result.projects['libs/my-lib'].targets.typecheck.inputs)
          .toMatchInlineSnapshot(`
          [
            "{projectRoot}/package.json",
            "{projectRoot}/tsconfig.json",
            "{workspaceRoot}/libs/**/*.ts",
            "{workspaceRoot}/libs/**/*.tsx",
            "{workspaceRoot}/libs/**/*.d.ts",
            "{workspaceRoot}/libs/**/*.cts",
            "{workspaceRoot}/libs/**/*.d.cts",
            "{workspaceRoot}/libs/**/*.mts",
            "{workspaceRoot}/libs/**/*.d.mts",
            {
              "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
              "transitive": true,
            },
            {
              "dependencies": true,
              "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
            },
          ]
        `);
      });

      it('should not expand "." in `include` when the project directory name contains a dot, matching TypeScript', async () => {
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my.lib/tsconfig.json': JSON.stringify({
            include: ['.'],
            // set this to keep outputs smaller
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my.lib/package.json': `{}`,
        });

        const result = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          {}
        );
        expect(result.projects['libs/my.lib'].targets.typecheck.inputs)
          .toMatchInlineSnapshot(`
          [
            "{projectRoot}/package.json",
            "{projectRoot}/tsconfig.json",
            "{projectRoot}",
            {
              "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
              "transitive": true,
            },
            {
              "dependencies": true,
              "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
            },
          ]
        `);
      });

      it('should not add exclude paths that are covered by non-glob include paths of other tsconfig files', async () => {
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            include: ['.'],
            references: [{ path: './tsconfig.lib.json' }],
          }),
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            include: ['src'],
            exclude: ['src/**/*.spec.ts'], // should be ignored because the root include "." covers it
          }),
          'libs/my-lib/package.json': `{}`,
        });

        const result = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          {}
        );
        expect(result.projects['libs/my-lib'].targets.typecheck.inputs)
          .toMatchInlineSnapshot(`
          [
            "{projectRoot}/package.json",
            "{projectRoot}/tsconfig.json",
            "{projectRoot}/tsconfig.lib.json",
            "{projectRoot}/**/*.ts",
            "{projectRoot}/**/*.tsx",
            "{projectRoot}/**/*.d.ts",
            "{projectRoot}/**/*.cts",
            "{projectRoot}/**/*.d.cts",
            "{projectRoot}/**/*.mts",
            "{projectRoot}/**/*.d.mts",
            "{projectRoot}/src/**/*.ts",
            "{projectRoot}/src/**/*.tsx",
            "{projectRoot}/src/**/*.d.ts",
            "{projectRoot}/src/**/*.cts",
            "{projectRoot}/src/**/*.d.cts",
            "{projectRoot}/src/**/*.mts",
            "{projectRoot}/src/**/*.d.mts",
            {
              "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
              "transitive": true,
            },
            {
              "dependencies": true,
              "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
            },
          ]
        `);
      });

      it('should expand directory paths in `exclude` to cover their whole subtree', async () => {
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            include: ['src'],
            exclude: ['tools'],
            // set this to keep outputs smaller
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/package.json': `{}`,
        });

        const result = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          {}
        );
        expect(result.projects['libs/my-lib'].targets.typecheck.inputs)
          .toMatchInlineSnapshot(`
          [
            "{projectRoot}/package.json",
            "{projectRoot}/tsconfig.json",
            "{projectRoot}/src/**/*.ts",
            "{projectRoot}/src/**/*.tsx",
            "{projectRoot}/src/**/*.d.ts",
            "{projectRoot}/src/**/*.cts",
            "{projectRoot}/src/**/*.d.cts",
            "{projectRoot}/src/**/*.mts",
            "{projectRoot}/src/**/*.d.mts",
            "!{projectRoot}/tools/**/*",
            {
              "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
              "transitive": true,
            },
            {
              "dependencies": true,
              "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
            },
          ]
        `);
      });

      it('should normalize and add directories in `include` with the ts and js extensions when `allowJs` is true', async () => {
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            include: ['src'],
            // set this to keep outputs smaller
            compilerOptions: { outDir: 'dist', allowJs: true },
          }),
          'libs/my-lib/package.json': `{}`,
        });

        expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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

        expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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

        expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                      "!{workspaceRoot}/node_modules/**/*",
                      "!{workspaceRoot}/tmp/**/*",
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                      "!{workspaceRoot}/node_modules/**/*",
                      "!{workspaceRoot}/dist/**/*",
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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

        expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                      "!{workspaceRoot}/node_modules/**/*",
                      "!{workspaceRoot}/tmp/**/*",
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
                      },
                      "^{projectRoot}/tsconfig.json",
                      {
                        "always": true,
                        "fields": [
                          "name",
                          "type",
                          "exports",
                          "imports",
                          "main",
                          "module",
                          "types",
                          "typings",
                          "typesVersions",
                        ],
                        "json": "{workspaceRoot}/libs/my-lib/nested-project/package.json",
                      },
                      {
                        "always": true,
                        "fields": [
                          "name",
                          "type",
                          "exports",
                          "imports",
                          "main",
                          "module",
                          "types",
                          "typings",
                          "typesVersions",
                        ],
                        "json": "{workspaceRoot}/libs/other-lib/package.json",
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
                      "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}",
                      "{projectRoot}/dist/tsconfig.tsbuildinfo",
                      "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
                      "{projectRoot}/dist/tsconfig.spec.tsbuildinfo",
                      "{projectRoot}/cypress/dist/**/*.{d.ts,d.cts,d.mts}",
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}",
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

      it('should match include specs of internal references under directories with glob characters literally', async () => {
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            files: [],
            references: [{ path: './configs/(group)/tsconfig.json' }],
          }),
          'libs/my-lib/configs/(group)/tsconfig.json': JSON.stringify({
            include: ['src/**/*.ts', '[id].ts'],
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/package.json': `{}`,
        });

        const result = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          {}
        );
        const inputs = result.projects['libs/my-lib'].targets.typecheck
          .inputs as string[];
        const includeInputs = inputs.filter(
          (i) => typeof i === 'string' && i.includes('configs/')
        );
        expect(includeInputs).toEqual([
          '{projectRoot}/configs/\\(group\\)/tsconfig.json',
          '{projectRoot}/configs/\\(group\\)/src/**/*.ts',
          '{projectRoot}/configs/\\(group\\)/\\[id\\].ts',
        ]);

        const globs = includeInputs.map((i) => i.replace('{projectRoot}/', ''));
        expect(
          matchGlobPaths(globs, [
            'configs/(group)/src/a.ts',
            'configs/group/src/a.ts',
            'configs/(group)/[id].ts',
            'configs/(group)/i.ts',
          ])
        ).toEqual([true, false, true, false]);
      });

      it('should collect distinct tsconfig patterns from file-specific external project references', async () => {
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            include: ['src/**/*.ts'],
            references: [
              { path: './tsconfig.lib.json' },
              { path: './tsconfig.spec.json' },
            ],
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.spec.ts'],
            references: [
              { path: '../other-lib/tsconfig.lib.json' }, // file-specific external ref
            ],
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/tsconfig.spec.json': JSON.stringify({
            include: ['src/**/*.spec.ts'],
            references: [
              { path: './tsconfig.lib.json' },
              { path: '../other-lib/tsconfig.spec.json' }, // file-specific external ref
            ],
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/package.json': `{}`,
          'libs/other-lib/tsconfig.json': JSON.stringify({
            references: [
              { path: './tsconfig.lib.json' },
              { path: './tsconfig.spec.json' },
            ],
          }),
          'libs/other-lib/tsconfig.lib.json': JSON.stringify({
            include: ['src/**/*.ts'],
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/other-lib/tsconfig.spec.json': JSON.stringify({
            include: ['src/**/*.spec.ts'],
            compilerOptions: { outDir: 'dist' },
          }),
        });
        const result = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          {}
        );
        const myLibTargets = result.projects['libs/my-lib']?.targets;
        // typecheck collects both tsconfig.lib.json and tsconfig.spec.json
        // because both internal refs have file-specific external references
        expect(myLibTargets.typecheck.inputs).toContain(
          '^{projectRoot}/tsconfig.lib.json'
        );
        expect(myLibTargets.typecheck.inputs).toContain(
          '^{projectRoot}/tsconfig.spec.json'
        );
      });

      it('should use relative paths for nested tsconfig references in external deps', async () => {
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            include: ['src/**/*.ts'],
            references: [
              { path: './tsconfig.lib.json' },
              { path: '../other-lib' }, // directory ref to external dep
            ],
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            include: ['src/**/*.ts'],
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/package.json': `{}`,
          'libs/other-lib/tsconfig.json': JSON.stringify({
            references: [
              { path: './tsconfig.lib.json' },
              { path: './cypress/tsconfig.json' }, // nested dir inner ref
            ],
          }),
          'libs/other-lib/tsconfig.lib.json': JSON.stringify({
            include: ['src/**/*.ts'],
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/other-lib/cypress/tsconfig.json': JSON.stringify({
            include: ['**/*.cy.ts'],
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/other-lib/package.json': `{}`,
        });
        const result = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          {}
        );
        const myLibTargets = result.projects['libs/my-lib']?.targets;
        // should include nested path, not just the basename
        expect(myLibTargets.typecheck.inputs).toContain(
          '^{projectRoot}/cypress/tsconfig.json'
        );
        expect(myLibTargets.typecheck.inputs).toContain(
          '^{projectRoot}/tsconfig.lib.json'
        );
        expect(myLibTargets.typecheck.inputs).toContain(
          '^{projectRoot}/tsconfig.json'
        );
      });

      it('should collect tsconfig paths from `extends` chains in external project references', async () => {
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            include: ['src/**/*.ts'],
            references: [
              { path: './tsconfig.lib.json' },
              { path: '../other-lib/tsconfig.lib.json' },
            ],
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            include: ['src/**/*.ts'],
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/package.json': `{}`,
          'libs/other-lib/tsconfig.json': JSON.stringify({
            references: [{ path: './tsconfig.lib.json' }],
          }),
          // tsconfig.lib.json in the external dep extends a same-project
          // tsconfig.shared.json — tsc reads it via the extends chain, so it
          // must be emitted as an input pattern.
          'libs/other-lib/tsconfig.lib.json': JSON.stringify({
            extends: './tsconfig.shared.json',
            include: ['src/**/*.ts'],
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/other-lib/tsconfig.shared.json': JSON.stringify({
            compilerOptions: { strict: true },
          }),
          'libs/other-lib/package.json': `{}`,
        });
        const result = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          {}
        );
        const myLibTargets = result.projects['libs/my-lib']?.targets;
        expect(myLibTargets.typecheck.inputs).toContain(
          '^{projectRoot}/tsconfig.lib.json'
        );
        expect(myLibTargets.typecheck.inputs).toContain(
          '^{projectRoot}/tsconfig.shared.json'
        );
      });

      it('should preserve shared external reference subtrees with cycles and missing configs', async () => {
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'tsconfig.base.json': JSON.stringify({
            compilerOptions: { strict: true },
          }),
          'apps/app-one/tsconfig.json': JSON.stringify({
            references: [{ path: '../../libs/shared' }],
            compilerOptions: { outDir: 'dist' },
          }),
          'apps/app-one/package.json': `{}`,
          'apps/app-two/tsconfig.json': JSON.stringify({
            references: [{ path: '../../libs/shared' }],
            compilerOptions: { outDir: 'dist' },
          }),
          'apps/app-two/package.json': `{}`,
          'libs/shared/tsconfig.json': JSON.stringify({
            extends: '../../tsconfig.base.json',
            references: [
              { path: './tsconfig.lib.json' },
              { path: './nested/tsconfig.json' },
              { path: './missing/tsconfig.json' },
            ],
          }),
          'libs/shared/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/shared/nested/tsconfig.json': JSON.stringify({
            references: [{ path: '../tsconfig.json' }],
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/shared/package.json': `{}`,
        });

        const result = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          {}
        );
        const expectedPatterns = [
          '^{projectRoot}/tsconfig.json',
          '^{projectRoot}/tsconfig.lib.json',
          '^{projectRoot}/nested/tsconfig.json',
        ];

        for (const projectRoot of ['apps/app-one', 'apps/app-two']) {
          expect(
            result.projects[projectRoot].targets.typecheck.inputs.filter(
              (input) =>
                typeof input === 'string' && input.startsWith('^{projectRoot}/')
            )
          ).toEqual(expectedPatterns);
        }
      });

      it('should not reuse reference expansions across invocations', async () => {
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'apps/my-app/tsconfig.json': JSON.stringify({
            references: [{ path: '../../libs/shared' }],
            compilerOptions: { outDir: 'dist' },
          }),
          'apps/my-app/package.json': `{}`,
          'libs/shared/tsconfig.json': JSON.stringify({
            references: [{ path: './tsconfig.one.json' }],
          }),
          'libs/shared/tsconfig.one.json': JSON.stringify({
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/shared/tsconfig.two.json': JSON.stringify({
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/shared/package.json': `{}`,
        });

        const firstResult = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          {}
        );
        expect(
          firstResult.projects['apps/my-app'].targets.typecheck.inputs
        ).toContain('^{projectRoot}/tsconfig.one.json');

        await tempFs.createFiles({
          'libs/shared/tsconfig.json': JSON.stringify({
            references: [{ path: './tsconfig.two.json' }],
          }),
        });
        setupWorkspaceContext(tempFs.tempDir);

        const secondResult = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          {}
        );
        expect(
          secondResult.projects['apps/my-app'].targets.typecheck.inputs
        ).toContain('^{projectRoot}/tsconfig.two.json');
        expect(
          secondResult.projects['apps/my-app'].targets.typecheck.inputs
        ).not.toContain('^{projectRoot}/tsconfig.one.json');
      });

      it('should normalize and add directories in `include` from internal project references', async () => {
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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

        expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}",
                      "{projectRoot}/dist/tsconfig.tsbuildinfo",
                      "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
                      "{projectRoot}/dist/tsconfig.spec.tsbuildinfo",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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

        let result = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          {}
        );
        expect(result.projects['libs/my-lib'].targets.typecheck.inputs)
          .toMatchInlineSnapshot(`
          [
            "{projectRoot}/package.json",
            "{projectRoot}/tsconfig.json",
            "{projectRoot}/tsconfig.lib.json",
            "{projectRoot}/tsconfig.spec.json",
            "{projectRoot}/src/**/*.ts",
            "{projectRoot}/src/**/*.spec.ts",
            {
              "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
              "transitive": true,
            },
            {
              "dependencies": true,
              "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
            },
          ]
        `);

        // other file include pattern is a subset of exclude pattern
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        result = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          {}
        );
        expect(result.projects['libs/my-lib'].targets.typecheck.inputs)
          .toMatchInlineSnapshot(`
          [
            "{projectRoot}/package.json",
            "{projectRoot}/tsconfig.json",
            "{projectRoot}/tsconfig.lib.json",
            "{projectRoot}/tsconfig.spec.json",
            "{projectRoot}/**/*.ts",
            "{projectRoot}/src/**/*.spec.ts",
            {
              "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
              "transitive": true,
            },
            {
              "dependencies": true,
              "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
            },
          ]
        `);

        // exclude pattern is a subset of other file include pattern
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        result = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          {}
        );
        expect(result.projects['libs/my-lib'].targets.typecheck.inputs)
          .toMatchInlineSnapshot(`
          [
            "{projectRoot}/package.json",
            "{projectRoot}/tsconfig.json",
            "{projectRoot}/tsconfig.lib.json",
            "{projectRoot}/tsconfig.spec.json",
            "{projectRoot}/src/**/*.ts",
            "{projectRoot}/**/*.spec.ts",
            {
              "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
              "transitive": true,
            },
            {
              "dependencies": true,
              "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
            },
          ]
        `);

        // handles mismatches with leading `./`
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        result = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          {}
        );
        expect(result.projects['libs/my-lib'].targets.typecheck.inputs)
          .toMatchInlineSnapshot(`
          [
            "{projectRoot}/package.json",
            "{projectRoot}/tsconfig.json",
            "{projectRoot}/tsconfig.lib.json",
            "{projectRoot}/tsconfig.spec.json",
            "{projectRoot}/src/**/*.ts",
            "{projectRoot}/**/*.spec.ts",
            {
              "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
              "transitive": true,
            },
            {
              "dependencies": true,
              "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
            },
          ]
        `);

        // no matching pattern in the exclude list
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        result = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          {}
        );
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
            {
              "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
              "transitive": true,
            },
            {
              "dependencies": true,
              "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
            },
          ]
        `);
      });

      it('should fall back to named inputs when not using include', async () => {
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': JSON.stringify({ files: ['main.ts'] }),
          'libs/my-lib/package.json': `{}`,
        });
        expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            compilerOptions: { outFile: '../../dist/libs/my-lib/index.js' },
            files: ['main.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });
        expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            compilerOptions: { outDir: '../../dist/libs/my-lib' },
            files: ['main.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });
        expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{workspaceRoot}/dist/libs/my-lib/**/*.{d.ts,d.cts,d.mts}",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
          await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/out-tsc/my-lib/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                      "{projectRoot}/out-tsc/tsconfig.lib.tsbuildinfo",
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/tsconfig.tsbuildinfo",
                      "{projectRoot}/out-tsc/my-lib/**/*.{d.ts,d.cts,d.mts}",
                      "{projectRoot}/out-tsc/tsconfig.lib.tsbuildinfo",
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

      it('should resolve the tsbuildinfo file relative to rootDir, even outside outDir', async () => {
        // tsc resolves the config path (sans extension) relative to rootDir
        // against outDir. With rootDir 'src' the config sits one level above
        // it, so the tsbuildinfo lands at the project root, not inside outDir.
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            files: [],
            references: [{ path: './tsconfig.lib.json' }],
          }),
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist', rootDir: 'src' },
            files: ['src/main.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });

        const result = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          { build: { configName: 'tsconfig.lib.json' } }
        );

        expect(result.projects['libs/my-lib'].targets.build.outputs)
          .toMatchInlineSnapshot(`
          [
            "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
            "{projectRoot}/tsconfig.lib.tsbuildinfo",
          ]
        `);
      });

      it('should infer the same tsbuildinfo file from the persisted tsconfig cache when rootDir is the workspace root', async () => {
        process.env.NX_CACHE_PROJECT_GRAPH = 'true';
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'tsconfig.base.json': JSON.stringify({
            compilerOptions: { rootDir: '.' },
          }),
          'libs/my-lib/tsconfig.json': JSON.stringify({
            extends: '../../tsconfig.base.json',
            files: [],
            references: [{ path: './tsconfig.lib.json' }],
          }),
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            extends: './tsconfig.json',
            compilerOptions: { outDir: 'out-tsc/lib' },
            include: ['src/**/*.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });

        const fromParsedTsconfigs = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          {}
        );
        // keep the persisted tsconfig cache but drop the computed targets
        const cacheDir = 'tmp/project-graph-cache';
        expect(existsSync(join(cacheDir, 'tsconfig-files.hash'))).toBe(true);
        for (const file of readdirSync(cacheDir)) {
          if (file.startsWith('tsc-')) {
            rmSync(join(cacheDir, file));
          }
        }
        const fromTsconfigCache = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          {}
        );

        const outputs =
          fromParsedTsconfigs.projects['libs/my-lib'].targets.typecheck.outputs;
        expect(outputs).toContain(
          '{projectRoot}/out-tsc/lib/libs/my-lib/tsconfig.lib.tsbuildinfo'
        );
        expect(
          fromTsconfigCache.projects['libs/my-lib'].targets.typecheck.outputs
        ).toEqual(outputs);
      });

      it('should add the inline output files when `outDir` is not defined', async () => {
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            files: ['main.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });
        expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
                      },
                      "^{projectRoot}/tsconfig.json",
                      {
                        "always": true,
                        "fields": [
                          "name",
                          "type",
                          "exports",
                          "imports",
                          "main",
                          "module",
                          "types",
                          "typings",
                          "typesVersions",
                        ],
                        "json": "{workspaceRoot}/libs/my-lib/nested-project/package.json",
                      },
                      {
                        "always": true,
                        "fields": [
                          "name",
                          "type",
                          "exports",
                          "imports",
                          "main",
                          "module",
                          "types",
                          "typings",
                          "typesVersions",
                        ],
                        "json": "{workspaceRoot}/libs/other-lib/package.json",
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
                      "{projectRoot}/tsconfig.tsbuildinfo",
                      "{workspaceRoot}/dist/libs/my-lib/lib.js",
                      "{workspaceRoot}/dist/libs/my-lib/lib.js.map",
                      "{workspaceRoot}/dist/libs/my-lib/lib.d.ts",
                      "{workspaceRoot}/dist/libs/my-lib/lib.d.ts.map",
                      "{workspaceRoot}/dist/libs/my-lib/lib.tsbuildinfo",
                      "{workspaceRoot}/dist/out-tsc/libs/my-lib/specs/**/*.{d.ts,d.cts,d.mts}",
                      "{workspaceRoot}/dist/out-tsc/libs/my-lib/specs/tsconfig.spec.tsbuildinfo",
                      "{workspaceRoot}/dist/out-tsc/libs/my-lib/cypress/**/*.{d.ts,d.cts,d.mts}",
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{workspaceRoot}/dist/out-tsc/libs/my-lib/nested-project/**/*.{d.ts,d.cts,d.mts}",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            compilerOptions: {
              outFile: '../../dist/libs/my-lib/index.js',
              tsBuildInfoFile: '../../dist/libs/my-lib/my-lib.tsbuildinfo',
            },
            files: ['main.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });
        expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            compilerOptions: {
              tsBuildInfoFile: '../../dist/libs/my-lib/my-lib.tsbuildinfo',
            },
            files: ['main.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });
        expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            compilerOptions: {
              outDir: 'dist',
              tsBuildInfoFile: 'my-lib.tsbuildinfo',
            },
            files: ['main.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });

        expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            compilerOptions: {
              outDir: 'dist',
              tsBuildInfoFile: 'dist/my-lib.tsbuildinfo',
            },
            files: ['main.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });

        expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            compilerOptions: { outDir: '${configDir}/dist' },
            files: ['main.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });
        expect(await invokeCreateNodesOnMatchingFiles(configFiles, context, {}))
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}",
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

  describe('typecheck target outside TS solution setups', () => {
    beforeEach(() => {
      (isUsingTsSolutionSetup as Mock).mockReturnValue(false);
    });

    it('should check the app tsconfig without emitting', async () => {
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'apps/my-app/tsconfig.json': JSON.stringify({
          files: [],
          references: [
            { path: './tsconfig.app.json' },
            { path: './tsconfig.spec.json' },
          ],
        }),
        'apps/my-app/tsconfig.app.json': JSON.stringify({
          include: ['src/**/*.ts'],
        }),
        'apps/my-app/tsconfig.spec.json': JSON.stringify({
          include: ['src/**/*.spec.ts'],
        }),
        'apps/my-app/project.json': `{}`,
      });

      const { projects } = await invokeCreateNodesOnMatchingFiles(
        configFiles,
        context,
        {}
      );
      const target = projects['apps/my-app'].targets.typecheck;

      expect(target.command).toBe('tsc -p tsconfig.app.json --noEmit');
      expect(target.options).toEqual({ cwd: 'apps/my-app' });
      expect(target.dependsOn).toBeUndefined();
      expect(target.outputs).toBeUndefined();
      expect(target.syncGenerators).toBeUndefined();
      expect(target.inputs).toEqual([
        'production',
        '^production',
        { externalDependencies: ['typescript'] },
      ]);
    });

    it('should add the root package.json aliases of typescript that the lockfile installs to the inputs', async () => {
      process.env.NX_CACHE_PROJECT_GRAPH = 'true';
      // Generated by a real pnpm 12.4.2 install. pnpm installs the root's own
      // peers, so `typescript-peer` has a graph node. An override removes the
      // `constructor` alias, which shares its name with an Object.prototype key.
      const lockFileWithNativeAlias = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

catalogs:
  default:
    typescript-latest:
      specifier: npm:typescript@6.0.3
      version: 6.0.3

overrides:
  constructor: '-'

importers:

  .:
    dependencies:
      typescript-latest:
        specifier: 'catalog:'
        version: typescript@6.0.3
      typescript-peer:
        specifier: npm:typescript@6.0.3
        version: typescript@6.0.3
    devDependencies:
      '@typescript/native':
        specifier: npm:typescript@6.0.3
        version: typescript@6.0.3
      typescript:
        specifier: 6.0.2
        version: 6.0.2
      typescript-memoize-alias:
        specifier: npm:typescript-memoize@1.1.1
        version: typescript-memoize@1.1.1

packages:

  typescript-memoize@1.1.1:
    resolution: {integrity: sha512-GQ90TcKpIH4XxYTI2F98yEQYZgjNMOGPpOgdjIBhaLaWji5HPWlRnZ4AeA1hfBxtY7bCGDJsqDDHk/KaHOl5bA==}

  typescript@6.0.2:
    resolution: {integrity: sha512-bGdAIrZ0wiGDo5l8c++HWtbaNCWTS4UTv7RaTH/ThVIgjkveJt83m74bBHMJkuCbslY8ixgLBVZJIOiQlQTjfQ==}
    engines: {node: '>=14.17'}
    hasBin: true

  typescript@6.0.3:
    resolution: {integrity: sha512-y2TvuxSZPDyQakkFRPZHKFm+KKVqIisdg9/CZwm9ftvKXLP8NRWj38/ODjNbr43SsoXqNuAisEf1GdCxqWcdBw==}
    engines: {node: '>=14.17'}
    hasBin: true

snapshots:

  typescript-memoize@1.1.1: {}

  typescript@6.0.2: {}

  typescript@6.0.3: {}
`;
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'pnpm-lock.yaml': lockFileWithNativeAlias,
        'node_modules/.modules.yaml': '{}',
        'pnpm-workspace.yaml': `catalog:\n  typescript-latest: npm:typescript@6.0.3\noverrides:\n  constructor: '-'\n`,
        'package.json': JSON.stringify({
          dependencies: { 'typescript-latest': 'catalog:' },
          devDependencies: {
            typescript: '6.0.2',
            '@typescript/native': 'npm:typescript@6.0.3',
            constructor: 'npm:typescript@6.0.3',
            'typescript-memoize-alias': 'npm:typescript-memoize@1.1.1',
          },
          peerDependencies: { 'typescript-peer': 'npm:typescript@6.0.3' },
        }),
        'apps/my-app/tsconfig.json': JSON.stringify({
          include: ['src/**/*.ts'],
        }),
        'apps/my-app/project.json': `{}`,
      });

      const withNativeAlias = await invokeCreateNodesOnMatchingFiles(
        configFiles,
        context,
        {}
      );

      expect(
        withNativeAlias.projects['apps/my-app'].targets.typecheck.inputs
      ).toEqual([
        'production',
        '^production',
        {
          externalDependencies: [
            'typescript',
            '@typescript/native',
            'typescript-latest',
          ],
        },
      ]);

      // The same install with `overrides: { '@typescript/native': '-' }`,
      // which leaves the alias out of the lockfile and node_modules
      await applyFilesToTempFsAndContext(tempFs, {
        'pnpm-lock.yaml': lockFileWithNativeAlias
          .replace(
            `  constructor: '-'\n`,
            `  constructor: '-'\n  '@typescript/native': '-'\n`
          )
          .replace(
            `      '@typescript/native':\n        specifier: npm:typescript@6.0.3\n        version: typescript@6.0.3\n`,
            ''
          ),
        'pnpm-workspace.yaml': `catalog:\n  typescript-latest: npm:typescript@6.0.3\noverrides:\n  constructor: '-'\n  '@typescript/native': '-'\n`,
      });

      const withoutNativeAlias = await invokeCreateNodesOnMatchingFiles(
        configFiles,
        context,
        {}
      );

      expect(
        withoutNativeAlias.projects['apps/my-app'].targets.typecheck.inputs
      ).toEqual([
        'production',
        '^production',
        { externalDependencies: ['typescript', 'typescript-latest'] },
      ]);
    });

    it('should fall back to the lib and then the root tsconfig', async () => {
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': JSON.stringify({
          files: [],
          references: [{ path: './tsconfig.lib.json' }],
        }),
        'libs/my-lib/tsconfig.lib.json': JSON.stringify({
          include: ['src/**/*.ts'],
        }),
        'libs/my-lib/project.json': `{}`,
        'libs/other-lib/tsconfig.json': JSON.stringify({
          include: ['src/**/*.ts'],
        }),
        'libs/other-lib/project.json': `{}`,
      });

      const { projects } = await invokeCreateNodesOnMatchingFiles(
        configFiles,
        context,
        { compiler: 'tsgo' }
      );

      expect(projects['libs/my-lib'].targets.typecheck.command).toBe(
        'tsgo -p tsconfig.lib.json --noEmit'
      );
      expect(projects['libs/other-lib'].targets.typecheck.command).toBe(
        'tsgo --noEmit'
      );
    });

    it('should skip projects whose build already type-checks', async () => {
      const tsconfig = JSON.stringify({ include: ['src/**/*.ts'] });
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/tsc-lib/tsconfig.json': tsconfig,
        'libs/tsc-lib/project.json': JSON.stringify({
          targets: { build: { executor: '@nx/js:tsc' } },
        }),
        'apps/webpack-app/tsconfig.json': tsconfig,
        'apps/webpack-app/project.json': `{}`,
        'apps/webpack-app/webpack.config.js': `module.exports = {};`,
        'libs/package-json-lib/tsconfig.json': tsconfig,
        'libs/package-json-lib/package.json': JSON.stringify({
          name: 'package-json-lib',
          nx: { targets: { build: { executor: '@nx/js:tsc' } } },
        }),
        'apps/esbuild-app/tsconfig.json': tsconfig,
        'apps/esbuild-app/project.json': JSON.stringify({
          targets: {
            build: {
              executor: '@nx/esbuild:esbuild',
              options: { skipTypeCheck: true },
            },
          },
        }),
      });

      const { projects } = await invokeCreateNodesOnMatchingFiles(
        configFiles,
        context,
        {}
      );

      expect(projects['libs/tsc-lib']?.targets?.typecheck).toBeUndefined();
      expect(
        projects['libs/package-json-lib']?.targets?.typecheck
      ).toBeUndefined();
      expect(projects['apps/webpack-app']?.targets?.typecheck).toBeUndefined();
      expect(projects['apps/esbuild-app'].targets.typecheck.command).toBe(
        'tsc --noEmit'
      );
    });

    it('should not fail when an extended tsconfig is missing', async () => {
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'tsconfig.base.json': JSON.stringify({ compilerOptions: {} }),
        'libs/my-lib/tsconfig.json': JSON.stringify({
          extends: '../../tsconfig.base.json',
          include: ['src/**/*.ts'],
        }),
        'libs/my-lib/project.json': `{}`,
      });
      await invokeCreateNodesOnMatchingFiles(configFiles, context, {});
      tempFs.removeFileSync('tsconfig.base.json');
      configFiles = configFiles.filter((f) => f !== 'tsconfig.base.json');

      const { projects } = await invokeCreateNodesOnMatchingFiles(
        configFiles,
        context,
        {}
      );

      expect(projects['libs/my-lib'].targets.typecheck.command).toBe(
        'tsc --noEmit'
      );
    });

    it('should respect addTypecheckTarget: false', async () => {
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': JSON.stringify({
          include: ['src/**/*.ts'],
          nx: { addTypecheckTarget: false },
        }),
        'libs/my-lib/project.json': `{}`,
      });

      const { projects } = await invokeCreateNodesOnMatchingFiles(
        configFiles,
        context,
        {}
      );

      expect(projects['libs/my-lib']?.targets?.typecheck).toBeUndefined();
    });
  });

  describe('build target', () => {
    it('should not create a node with a build target for a project level tsconfig files by default', async () => {
      // Sibling package.json
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{"compilerOptions": {"outDir": "dist"}}`,
        'libs/my-lib/tsconfig.build.json': `{}`,
        'libs/my-lib/package.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{}`,
        'libs/my-lib/tsconfig.build.json': `{}`,
        'libs/my-lib/project.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{"compilerOptions": {"outDir": "dist"}}`,
        'libs/my-lib/tsconfig.build.json': `{}`,
        'libs/my-lib/package.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{}`,
        'libs/my-lib/tsconfig.build.json': `{}`,
        'libs/my-lib/project.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                    "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                    "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                    "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                    "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
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
                  "command": "npx nx watch --projects my-lib --includeDependencies -- npx nx build-deps my-lib",
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{"compilerOptions": {"outDir": "dist"}}`,
        'libs/my-lib/tsconfig.build.json': `{}`,
        'libs/my-lib/project.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                    "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                    "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
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
                  "command": "npx nx watch --projects my-lib --includeDependencies -- npx nx build-deps my-lib",
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
    });

    it('should create a node with a build target with "--verbose" flag when the "verboseOutput" plugin option is true', async () => {
      // Sibling package.json
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                    "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                    "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
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
                  "command": "npx nx watch --projects my-lib --includeDependencies -- npx nx build-deps my-lib",
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{"compilerOptions": {"outDir": "dist"}}`,
        'libs/my-lib/tsconfig.build.json': `{}`,
        'libs/my-lib/project.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                    "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                    "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
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
                  "command": "npx nx watch --projects my-lib --includeDependencies -- npx nx build-deps my-lib",
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
    });

    it('should create a node with a build target when enabled, using a custom configured target name', async () => {
      // Sibling package.json
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{"compilerOptions": {"outDir": "dist"}}`,
        'libs/my-lib/tsconfig.build.json': `{}`,
        'libs/my-lib/package.json': `{ "main": "dist/index.js" }`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                    "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                    "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
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

    it('should create a build target with custom compiler option (tsgo)', async () => {
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{"compilerOptions": {"outDir": "dist"}}`,
        'libs/my-lib/package.json': `{ "main": "dist/index.js" }`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
          compiler: 'tsgo',
          typecheck: false,
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
                  "command": "tsgo --build tsconfig.lib.json",
                  "dependsOn": [
                    "^build",
                  ],
                  "inputs": [
                    "production",
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
                    },
                  ],
                  "metadata": {
                    "description": "Builds the project with \`tsc\`.",
                    "help": {
                      "command": "npx tsgo --build --help",
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
                    "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                    "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{}`,
        'libs/my-lib/tsconfig.build.json': `{"compilerOptions": {"outDir": "dist"}}`,
        'libs/my-lib/project.json': `{}`,
      });
      expect(
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                    "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                    "{projectRoot}/dist/tsconfig.build.tsbuildinfo",
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
        'libs/my-lib/tsconfig.json': JSON.stringify({
          references: [{ path: '../my-lib-2' }],
        }),
        'libs/my-lib/tsconfig.lib.json': `{}`,
        'libs/my-lib/package.json': `{}`,
      });

      await expect(
        invokeCreateNodesOnMatchingFiles(configFiles, context, {
          typecheck: false,
          build: true,
        })
      ).resolves.not.toThrow();
    });

    describe('inputs', () => {
      it('should add the config file and the `include` and `exclude` patterns', async () => {
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
          await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                      "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
          await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                      "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist' },
            include: ['src'],
          }),
          'libs/my-lib/tsconfig.json': `{}`,
          'libs/my-lib/package.json': `{"main": "dist/index.js"}`,
        });

        expect(
          await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                      "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
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

      it('should normalize and expand "." in `include` with the ts extensions', async () => {
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist' },
            include: ['.'],
          }),
          'libs/my-lib/tsconfig.json': `{}`,
          'libs/my-lib/package.json': `{"main": "dist/index.js"}`,
        });

        expect(
          await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                      "{projectRoot}/**/*.ts",
                      "{projectRoot}/**/*.tsx",
                      "{projectRoot}/**/*.d.ts",
                      "{projectRoot}/**/*.cts",
                      "{projectRoot}/**/*.d.cts",
                      "{projectRoot}/**/*.mts",
                      "{projectRoot}/**/*.d.mts",
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                      "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist', allowJs: true },
            include: ['src'],
          }),
          'libs/my-lib/tsconfig.json': `{}`,
          'libs/my-lib/package.json': `{"main": "dist/index.js"}`,
        });

        expect(
          await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                      "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist', resolveJsonModule: true },
            include: ['src'],
          }),
          'libs/my-lib/tsconfig.json': `{}`,
          'libs/my-lib/package.json': `{"main": "dist/index.js"}`,
        });

        expect(
          await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,json,d.ts,d.cts,d.mts}{,.map}",
                      "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
          await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,json,d.ts,d.cts,d.mts}{,.map}",
                      "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
          await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                      "!{workspaceRoot}/node_modules/**/*",
                      "!{workspaceRoot}/tmp/**/*",
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                      "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
          await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                      "!{workspaceRoot}/node_modules/**/*",
                      "!{workspaceRoot}/dist/**/*",
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                      "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
          await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                      "!{workspaceRoot}/node_modules/**/*",
                      "!{workspaceRoot}/tmp/**/*",
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                      "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
            include: ['**/*.ts'], // has no build target, so `tsc --build` compiles it from these sources
          }),
          'libs/my-lib/package.json': `{"main": "dist/index.js"}`, // Should be defined so that the project is considered buildable
        });
        expect(
          await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
                      },
                      "^{projectRoot}/tsconfig.json",
                      {
                        "always": true,
                        "fields": [
                          "name",
                          "type",
                          "exports",
                          "imports",
                          "main",
                          "module",
                          "types",
                          "typings",
                          "typesVersions",
                        ],
                        "json": "{workspaceRoot}/libs/other-lib/package.json",
                      },
                      {
                        "always": true,
                        "fileset": "{workspaceRoot}/libs/other-lib/**/*.ts",
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
                      "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                      "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
                      "{projectRoot}/dist/tsconfig.other.tsbuildinfo",
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

      it('should add the sources of referenced projects that have no build target', async () => {
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': '{}',
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist' },
            include: ['src/**/*.ts'],
            references: [
              { path: '../built-lib/tsconfig.lib.json' },
              { path: '../source-lib/tsconfig.lib.json' },
            ],
          }),
          'libs/my-lib/package.json': `{"main": "dist/index.js"}`,
          // built by its own task, so its declarations come from that task
          'libs/built-lib/tsconfig.json': '{}',
          'libs/built-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist' },
            include: ['src/**/*.ts'],
          }),
          'libs/built-lib/package.json': `{"main": "dist/index.js"}`,
          // consumed from source: its package.json points at the sources
          'libs/source-lib/tsconfig.json': '{}',
          'libs/source-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist' },
            include: ['src'],
            exclude: ['src/**/*.spec.ts', 'fixtures'],
            references: [{ path: '../nested-source-lib' }],
          }),
          'libs/source-lib/package.json': `{"main": "src/index.ts"}`,
          // reached only through source-lib, with the default include
          'libs/nested-source-lib/tsconfig.json': JSON.stringify({
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/nested-source-lib/package.json': `{"main": "src/index.ts"}`,
        });
        const result = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          { typecheck: false, build: true }
        );

        expect(result.projects['libs/built-lib'].targets.build).toBeDefined();
        expect(
          result.projects['libs/source-lib'].targets?.build
        ).toBeUndefined();
        expect(
          result.projects['libs/nested-source-lib'].targets?.build
        ).toBeUndefined();
        expect(result.projects['libs/my-lib'].targets.build.inputs)
          .toMatchInlineSnapshot(`
            [
              "{projectRoot}/package.json",
              "{projectRoot}/tsconfig.lib.json",
              "{projectRoot}/src/**/*.ts",
              {
                "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                "transitive": true,
              },
              {
                "dependencies": true,
                "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
              },
              "^{projectRoot}/tsconfig.lib.json",
              {
                "always": true,
                "fields": [
                  "name",
                  "type",
                  "exports",
                  "imports",
                  "main",
                  "module",
                  "types",
                  "typings",
                  "typesVersions",
                ],
                "json": "{workspaceRoot}/libs/built-lib/package.json",
              },
              {
                "always": true,
                "fields": [
                  "name",
                  "type",
                  "exports",
                  "imports",
                  "main",
                  "module",
                  "types",
                  "typings",
                  "typesVersions",
                ],
                "json": "{workspaceRoot}/libs/source-lib/package.json",
              },
              {
                "always": true,
                "fields": [
                  "name",
                  "type",
                  "exports",
                  "imports",
                  "main",
                  "module",
                  "types",
                  "typings",
                  "typesVersions",
                ],
                "json": "{workspaceRoot}/libs/nested-source-lib/package.json",
              },
              {
                "always": true,
                "fileset": "{workspaceRoot}/libs/source-lib/src/**/*.{ts,tsx,cts,mts}",
              },
              {
                "always": true,
                "fileset": "!{workspaceRoot}/libs/source-lib/src/**/*.spec.ts",
              },
              {
                "always": true,
                "fileset": "!{workspaceRoot}/libs/source-lib/fixtures/**/*",
              },
              {
                "always": true,
                "fileset": "{workspaceRoot}/libs/nested-source-lib/**/*.{ts,tsx,cts,mts}",
              },
              {
                "always": true,
                "fileset": "!{workspaceRoot}/libs/nested-source-lib/dist/**/*",
              },
            ]
          `);
        // The built project's sources reach the hash through its build task.
        expect(
          result.projects['libs/my-lib'].targets.build.inputs.filter(
            (input) =>
              typeof input !== 'string' &&
              'fileset' in input &&
              input.fileset.includes('libs/built-lib')
          )
        ).toEqual([]);
      });

      it("should not let an unbuilt reference's excludes remove inputs other configs need", async () => {
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/a/tsconfig.json': '{}',
          'libs/a/tsconfig.lib.json': JSON.stringify({
            extends: '../b/tsconfig.shared.json',
            compilerOptions: { outDir: 'dist' },
            include: ['src/**/*.ts'],
            references: [
              { path: '../b/tsconfig.lib.json' },
              { path: '../c/tsconfig.lib.json' },
              { path: '../d/tsconfig.lib.json' },
            ],
          }),
          'libs/a/package.json': `{"main": "dist/index.js"}`,
          // a extends b's shared config, which b's own config excludes
          'libs/b/tsconfig.json': '{}',
          'libs/b/tsconfig.shared.json': JSON.stringify({
            compilerOptions: { strict: true },
          }),
          'libs/b/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist' },
            include: ['src'],
            exclude: ['tsconfig.shared.json', 'src/**/*.spec.ts'],
          }),
          'libs/b/package.json': `{"main": "src/index.ts"}`,
          // c excludes a file that d includes
          'libs/c/tsconfig.json': '{}',
          'libs/c/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist' },
            include: ['src'],
            exclude: ['../d/src/generated.ts'],
          }),
          'libs/c/package.json': `{"main": "src/index.ts"}`,
          'libs/d/tsconfig.json': '{}',
          'libs/d/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist' },
            include: ['src'],
          }),
          'libs/d/package.json': `{"main": "src/index.ts"}`,
        });
        const result = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          { typecheck: false, build: true }
        );

        for (const project of ['libs/b', 'libs/c', 'libs/d']) {
          expect(result.projects[project].targets?.build).toBeUndefined();
        }
        const filesets = result.projects['libs/a'].targets.build.inputs.map(
          (input) =>
            typeof input === 'string'
              ? input
              : 'fileset' in input
                ? input.fileset
                : undefined
        );
        expect(filesets).toContain(
          '{workspaceRoot}/libs/b/tsconfig.shared.json'
        );
        expect(filesets).not.toContain(
          '!{workspaceRoot}/libs/b/tsconfig.shared.json'
        );
        expect(filesets).not.toContain(
          '!{workspaceRoot}/libs/d/src/generated.ts'
        );
        // An exclude inside the reference's own include still applies.
        expect(filesets).toContain('!{workspaceRoot}/libs/b/src/**/*.spec.ts');
      });

      describe("an unbuilt reference's negatives", () => {
        const buildFilesets = async (files: Record<string, string>) => {
          configFiles = await applyFilesToTempFsAndContext(tempFs, {
            'libs/a/tsconfig.json': '{}',
            'libs/a/package.json': `{"main": "dist/index.js"}`,
            'libs/b/tsconfig.json': '{}',
            'libs/b/package.json': `{"main": "src/index.ts"}`,
            ...files,
          });
          const result = await invokeCreateNodesOnMatchingFiles(
            configFiles,
            context,
            { typecheck: false, build: true }
          );
          expect(result.projects['libs/b'].targets?.build).toBeUndefined();
          return result.projects['libs/a'].targets.build.inputs.map((input) =>
            typeof input === 'string'
              ? input
              : 'fileset' in input
                ? input.fileset
                : undefined
          );
        };

        it('should drop an exclude glob that overlaps a glob another config includes', async () => {
          const filesets = await buildFilesets({
            'libs/a/tsconfig.lib.json': JSON.stringify({
              compilerOptions: { outDir: 'dist' },
              include: ['src/**/*.ts', '../b/**/*.d.ts'],
              references: [{ path: '../b/tsconfig.lib.json' }],
            }),
            'libs/b/tsconfig.lib.json': JSON.stringify({
              compilerOptions: { outDir: 'dist' },
              include: ['src'],
              exclude: ['types/**/*'],
            }),
          });

          expect(filesets).toContain('{workspaceRoot}/libs/b/**/*.d.ts');
          expect(filesets).not.toContain('!{workspaceRoot}/libs/b/types/**/*');
        });

        it('should drop an output directory that holds a config another config extends', async () => {
          const filesets = await buildFilesets({
            'libs/a/tsconfig.lib.json': JSON.stringify({
              extends: '../b/cfg/tsconfig.shared.json',
              compilerOptions: { outDir: 'dist' },
              include: ['src/**/*.ts'],
              references: [{ path: '../b/tsconfig.lib.json' }],
            }),
            'libs/b/cfg/tsconfig.shared.json': JSON.stringify({
              compilerOptions: { strict: true },
            }),
            'libs/b/tsconfig.lib.json': JSON.stringify({
              compilerOptions: { outDir: 'cfg' },
              include: ['src'],
            }),
          });

          expect(filesets).toContain(
            '{workspaceRoot}/libs/b/cfg/tsconfig.shared.json'
          );
          expect(filesets).not.toContain('!{workspaceRoot}/libs/b/cfg/**/*');
        });

        it('should keep an exclude that no other config reaches', async () => {
          const filesets = await buildFilesets({
            'libs/a/tsconfig.lib.json': JSON.stringify({
              compilerOptions: { outDir: 'dist' },
              include: ['src/**/*.ts'],
              references: [{ path: '../b/tsconfig.lib.json' }],
            }),
            'libs/b/tsconfig.lib.json': JSON.stringify({
              compilerOptions: { outDir: 'dist' },
              include: ['src'],
              exclude: ['**/*.spec.ts'],
            }),
          });

          expect(filesets).toContain('!{workspaceRoot}/libs/b/**/*.spec.ts');
        });
      });

      it('should infer the inputs again when a project deeper in the reference chain stops being built', async () => {
        process.env.NX_CACHE_PROJECT_GRAPH = 'true';
        const lib = (references: string[], main: string) => ({
          tsconfig: JSON.stringify({
            compilerOptions: { outDir: 'dist' },
            include: ['src/**/*.ts'],
            references: references.map((path) => ({ path })),
          }),
          packageJson: JSON.stringify({ main }),
        });
        const a = lib(['../b/tsconfig.lib.json'], 'dist/index.js');
        const b = lib(['../c/tsconfig.lib.json'], 'src/index.ts');
        const c = lib([], 'dist/index.js');
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/a/tsconfig.json': '{}',
          'libs/a/tsconfig.lib.json': a.tsconfig,
          'libs/a/package.json': a.packageJson,
          'libs/b/tsconfig.json': '{}',
          'libs/b/tsconfig.lib.json': b.tsconfig,
          'libs/b/package.json': b.packageJson,
          'libs/c/tsconfig.json': '{}',
          'libs/c/tsconfig.lib.json': c.tsconfig,
          'libs/c/package.json': c.packageJson,
        });
        const sourcesOf = async (project: string) => {
          const result = await invokeCreateNodesOnMatchingFiles(
            configFiles,
            context,
            { typecheck: false, build: true }
          );
          return result.projects['libs/a'].targets.build.inputs.filter(
            (input) =>
              typeof input !== 'string' &&
              'fileset' in input &&
              input.fileset.startsWith(`{workspaceRoot}/libs/${project}/`)
          );
        };

        expect(await sourcesOf('b')).not.toEqual([]);
        expect(await sourcesOf('c')).toEqual([]);

        // `c` now points at its sources, so it no longer gets a build target.
        await tempFs.createFiles({
          'libs/c/package.json': JSON.stringify({ main: 'src/index.ts' }),
        });
        expect(await sourcesOf('c')).toEqual([
          { fileset: '{workspaceRoot}/libs/c/src/**/*.ts', always: true },
        ]);
      });

      it('should infer the inputs again when a config a reference extends changes its options', async () => {
        process.env.NX_CACHE_PROJECT_GRAPH = 'true';
        const files = (bOptions: object) => ({
          'libs/a/tsconfig.json': '{}',
          'libs/a/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist' },
            include: ['src/**/*.ts'],
            references: [{ path: '../b/tsconfig.lib.json' }],
          }),
          'libs/a/package.json': `{"main": "dist/index.js"}`,
          'libs/b/tsconfig.json': JSON.stringify({ compilerOptions: bOptions }),
          'libs/b/tsconfig.lib.json': JSON.stringify({
            extends: './tsconfig.json',
            compilerOptions: { outDir: 'dist' },
            include: ['src'],
          }),
          'libs/b/package.json': `{"main": "src/index.ts"}`,
        });
        const sourcesOfB = async () => {
          const result = await invokeCreateNodesOnMatchingFiles(
            configFiles,
            context,
            { typecheck: false, build: true }
          );
          return result.projects['libs/a'].targets.build.inputs
            .filter(
              (input) =>
                typeof input !== 'string' &&
                'fileset' in input &&
                input.fileset.startsWith('{workspaceRoot}/libs/b/src/')
            )
            .map((input) => input.fileset);
        };

        configFiles = await applyFilesToTempFsAndContext(tempFs, files({}));
        expect(await sourcesOfB()).toEqual([
          '{workspaceRoot}/libs/b/src/**/*.{ts,tsx,cts,mts}',
        ]);

        configFiles = await applyFilesToTempFsAndContext(
          tempFs,
          files({ allowJs: true })
        );
        expect(await sourcesOfB()).toEqual([
          '{workspaceRoot}/libs/b/src/**/*.{ts,tsx,js,jsx,cts,cjs,mts,mjs}',
        ]);
      });

      it('should add the sources of unbuilt projects that reference each other', async () => {
        const lib = (reference: string) => ({
          tsconfig: JSON.stringify({
            compilerOptions: { outDir: 'dist' },
            include: ['src/**/*.ts'],
            references: [{ path: reference }],
          }),
        });
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/a/tsconfig.json': '{}',
          'libs/a/tsconfig.lib.json': lib('../b/tsconfig.lib.json').tsconfig,
          'libs/a/package.json': `{"main": "dist/index.js"}`,
          'libs/b/tsconfig.json': '{}',
          'libs/b/tsconfig.lib.json': lib('../c/tsconfig.lib.json').tsconfig,
          'libs/b/package.json': `{"main": "src/index.ts"}`,
          'libs/c/tsconfig.json': '{}',
          'libs/c/tsconfig.lib.json': lib('../b/tsconfig.lib.json').tsconfig,
          'libs/c/package.json': `{"main": "src/index.ts"}`,
        });
        const result = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          { typecheck: false, build: true }
        );

        expect(
          result.projects['libs/a'].targets.build.inputs.filter(
            (input) => typeof input !== 'string' && 'fileset' in input
          )
        ).toEqual([
          {
            dependencies: true,
            fileset: '{projectRoot}/**/*.{d.ts,d.cts,d.mts}',
          },
          { always: true, fileset: '{workspaceRoot}/libs/b/src/**/*.ts' },
          { always: true, fileset: '!{workspaceRoot}/libs/b/dist/**/*' },
          { always: true, fileset: '{workspaceRoot}/libs/c/src/**/*.ts' },
          { always: true, fileset: '!{workspaceRoot}/libs/c/dist/**/*' },
        ]);
      });

      it('should only collect tsconfig patterns from the build reference chain', async () => {
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.json': '{}',
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            include: ['src/**/*.ts'],
            references: [
              { path: '../other-lib/tsconfig.lib.json' }, // file-specific external ref
            ],
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/my-lib/package.json': `{"main": "dist/index.js"}`,
          'libs/other-lib/tsconfig.json': JSON.stringify({
            references: [
              { path: './tsconfig.lib.json' },
              { path: './tsconfig.spec.json' },
            ],
          }),
          'libs/other-lib/tsconfig.lib.json': JSON.stringify({
            include: ['src/**/*.ts'],
            compilerOptions: { outDir: 'dist' },
          }),
          'libs/other-lib/tsconfig.spec.json': JSON.stringify({
            include: ['src/**/*.spec.ts'],
            compilerOptions: { outDir: 'dist' },
          }),
        });
        const result = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          { typecheck: false, build: true }
        );
        const myLibTargets = result.projects['libs/my-lib']?.targets;
        // build only collects tsconfig.lib.json because the reference chain
        // from tsconfig.lib.json only goes through dep/tsconfig.lib.json
        expect(myLibTargets.build.inputs).toContain(
          '^{projectRoot}/tsconfig.lib.json'
        );
        expect(myLibTargets.build.inputs).not.toContain(
          '^{projectRoot}/tsconfig.spec.json'
        );
      });

      it('should normalize and add directories in `include` from internal project references', async () => {
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
          await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                      "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
                      "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,json,d.ts,d.cts,d.mts}{,.map}",
                      "{projectRoot}/dist/tsconfig.other.tsbuildinfo",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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

        let result = await invokeCreateNodesOnMatchingFiles(
          configFiles,
          context,
          {
            typecheck: false,
            build: true,
          }
        );
        expect(result.projects['libs/my-lib'].targets.build.inputs)
          .toMatchInlineSnapshot(`
          [
            "{projectRoot}/package.json",
            "{projectRoot}/tsconfig.lib.json",
            "{projectRoot}/tsconfig.other.json",
            "{projectRoot}/src/**/*.ts",
            "{projectRoot}/other/**/*.ts",
            "{projectRoot}/src/**/foo.ts",
            {
              "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
              "transitive": true,
            },
            {
              "dependencies": true,
              "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
            },
          ]
        `);

        // other file include pattern is a subset of exclude pattern
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        result = await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
            {
              "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
              "transitive": true,
            },
            {
              "dependencies": true,
              "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
            },
          ]
        `);

        // exclude pattern is a subset of other file include pattern
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        result = await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
            {
              "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
              "transitive": true,
            },
            {
              "dependencies": true,
              "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
            },
          ]
        `);

        // handles mismatches with leading `./`
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        result = await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
            {
              "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
              "transitive": true,
            },
            {
              "dependencies": true,
              "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
            },
          ]
        `);

        // no matching pattern in the exclude list
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        result = await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
            {
              "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
              "transitive": true,
            },
            {
              "dependencies": true,
              "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
            },
          ]
        `);
      });

      it('should fall back to named inputs when not using include', async () => {
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outDir: 'dist' },
            files: ['main.ts'],
          }),
          'libs/my-lib/tsconfig.json': `{}`,
          'libs/my-lib/package.json': `{"main": "dist/index.js"}`,
        });
        expect(
          await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                      "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
          await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
          await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{workspaceRoot}/dist/libs/my-lib/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                      "{workspaceRoot}/dist/libs/my-lib/tsconfig.lib.tsbuildinfo",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            files: ['main.ts'],
          }),
          'libs/my-lib/tsconfig.json': `{}`,
          'libs/my-lib/package.json': `{}`,
        });
        expect(
          await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
          await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{workspaceRoot}/dist/libs/my-lib/other/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                      "{workspaceRoot}/dist/libs/my-lib/other/tsconfig.other.tsbuildinfo",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
          await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
          await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
          await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
          await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
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
        configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
          await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                      {
                        "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                        "transitive": true,
                      },
                      {
                        "dependencies": true,
                        "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                      "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                      "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                    "{projectRoot}/src/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                    "{projectRoot}/src/tsconfig.lib.tsbuildinfo",
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                    "{projectRoot}/lib/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                    "{projectRoot}/lib/tsconfig.lib.tsbuildinfo",
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                    "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                    "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                    "{workspaceRoot}/libs/build/my-lib/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                    "{workspaceRoot}/libs/build/my-lib/tsconfig.lib.tsbuildinfo",
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                    "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                    "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                    "{projectRoot}/compiled/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                    "{projectRoot}/compiled/tsconfig.lib.tsbuildinfo",
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                    "external-build/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                    "external-build/tsconfig.lib.tsbuildinfo",
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                    "{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                    "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                    "{projectRoot}/build/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                    "{projectRoot}/build/tsconfig.lib.tsbuildinfo",
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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
                    "{projectRoot}/build/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
                    "{projectRoot}/build/tsconfig.lib.tsbuildinfo",
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
      configFiles = await applyFilesToTempFsAndContext(tempFs, {
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
        await invokeCreateNodesOnMatchingFiles(configFiles, context, {
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
                    {
                      "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
                      "transitive": true,
                    },
                    {
                      "dependencies": true,
                      "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}",
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

  it('should handle concurrent invocations without crashing', async () => {
    configFiles = await applyFilesToTempFsAndContext(tempFs, {
      'libs/my-lib/tsconfig.json': JSON.stringify({
        compilerOptions: { outDir: '../../dist/libs/my-lib' },
        files: [],
      }),
      'libs/my-lib/package.json': `{}`,
      'libs/other-lib/tsconfig.json': JSON.stringify({
        compilerOptions: { outDir: '../../dist/libs/other-lib' },
        files: [],
      }),
      'libs/other-lib/package.json': `{}`,
    });

    const [result1, result2] = await Promise.all([
      invokeCreateNodesOnMatchingFiles(configFiles, context, {}),
      invokeCreateNodesOnMatchingFiles(configFiles, context, {}),
    ]);

    expect(result1.projects['libs/my-lib']).toBeDefined();
    expect(result1.projects['libs/other-lib']).toBeDefined();
    expect(result2.projects['libs/my-lib']).toBeDefined();
    expect(result2.projects['libs/other-lib']).toBeDefined();
    expect(result1.projects['libs/my-lib'].targets.typecheck).toBeDefined();
    expect(result2.projects['libs/my-lib'].targets.typecheck).toBeDefined();
  });
});

async function applyFilesToTempFsAndContext(
  tempFs: TempFs,
  fileSys: Record<string, string>
): Promise<string[]> {
  await tempFs.createFiles(fileSys);
  const configFiles = Object.keys(fileSys).filter((file) =>
    picomatch(createNodesV2[0], { dot: true })(file)
  );
  setupWorkspaceContext(tempFs.tempDir);
  return configFiles;
}

async function invokeCreateNodesOnMatchingFiles(
  configFiles: string[],
  context: CreateNodesContext,
  pluginOptions: TscPluginOptions
) {
  const aggregateProjects: Record<string, any> = {};
  const results = await createNodesV2[1](configFiles, pluginOptions, context);
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
