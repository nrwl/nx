import { type CreateNodesContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { minimatch } from 'minimatch';
import { setupWorkspaceContext } from 'nx/src/utils/workspace-context';
import { PLUGIN_NAME, createNodesV2, type TscPluginOptions } from './plugin';

describe(`Plugin: ${PLUGIN_NAME}`, () => {
  let context: CreateNodesContext;
  let cwd = process.cwd();
  let tempFs: TempFs;
  let originalCacheProjectGraph: string | undefined;

  beforeEach(() => {
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
  });

  afterEach(() => {
    jest.resetModules();
    tempFs.cleanup();
    process.chdir(cwd);
    process.env.NX_CACHE_PROJECT_GRAPH = originalCacheProjectGraph;
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
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/package.json': `{}`,
      });
      expect(await invokeCreateNodesOnMatchingFiles(context, {}))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "projectType": "library",
              "targets": {
                "typecheck": {
                  "cache": true,
                  "command": "tsc --build --emitDeclarationOnly --pretty --verbose",
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
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/project.json': `{}`,
      });
      expect(await invokeCreateNodesOnMatchingFiles(context, {}))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "projectType": "library",
              "targets": {
                "typecheck": {
                  "cache": true,
                  "command": "tsc --build --emitDeclarationOnly --pretty --verbose",
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
        'libs/my-lib/tsconfig.json': `{}`,
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
              "projectType": "library",
              "targets": {
                "typecheck": {
                  "cache": true,
                  "command": "tsc --build --emitDeclarationOnly --pretty --verbose",
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
              "projectType": "library",
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
              "projectType": "library",
              "targets": {},
            },
          },
        }
      `);
    });

    it('should not invoke tsc with `--emitDeclarationOnly` when `noEmit` is set in the tsconfig.json file', async () => {
      // set directly in tsconfig.json file
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': JSON.stringify({
          compilerOptions: { noEmit: true },
        }),
        'libs/my-lib/package.json': `{}`,
      });
      expect(await invokeCreateNodesOnMatchingFiles(context, {}))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "projectType": "library",
              "targets": {
                "typecheck": {
                  "cache": true,
                  "command": "tsc --build --pretty --verbose",
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
        }),
        'libs/my-lib/package.json': `{}`,
      });
      expect(await invokeCreateNodesOnMatchingFiles(context, {}))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "projectType": "library",
              "targets": {
                "typecheck": {
                  "cache": true,
                  "command": "tsc --build --pretty --verbose",
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

    it('should not invoke tsc with `--emitDeclarationOnly` when `noEmit` is set in any of the referenced tsconfig.json files', async () => {
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': JSON.stringify({
          files: [],
          references: [{ path: './tsconfig.lib.json' }],
        }),
        'libs/my-lib/tsconfig.lib.json': JSON.stringify({
          compilerOptions: { noEmit: true },
        }),
        'libs/my-lib/package.json': `{}`,
      });
      expect(await invokeCreateNodesOnMatchingFiles(context, {}))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "projectType": "library",
              "targets": {
                "typecheck": {
                  "cache": true,
                  "command": "tsc --build --pretty --verbose",
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

    describe('inputs', () => {
      it('should add the config file and the `include` and `exclude` patterns', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': JSON.stringify({
            include: ['src/**/*.ts'],
            exclude: ['src/**/foo.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });
        expect(await invokeCreateNodesOnMatchingFiles(context, {}))
          .toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "projectType": "library",
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly --pretty --verbose",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
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
          }),
          'libs/my-lib/package.json': `{}`,
        });
        expect(await invokeCreateNodesOnMatchingFiles(context, {}))
          .toMatchInlineSnapshot(`
          {
            "projects": {
              "libs/my-lib": {
                "projectType": "library",
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly --pretty --verbose",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
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
          }),
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.spec.ts'],
          }),
          'libs/my-lib/tsconfig.spec.json': JSON.stringify({
            include: ['src/**/*.spec.ts'],
            references: [{ path: './tsconfig.lib.json' }],
          }),
          'libs/my-lib/cypress/tsconfig.json': JSON.stringify({
            include: ['**/*.ts', '../cypress.config.ts', '../**/*.cy.ts'],
            references: [{ path: '../tsconfig.lib.json' }],
          }),
          'libs/my-lib/package.json': `{}`,
          'libs/my-lib/nested-project/package.json': `{}`,
          'libs/my-lib/nested-project/tsconfig.json': JSON.stringify({
            include: ['lib/**/*.ts'], // different pattern that should not be included in my-lib because it's an external project reference
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
                "projectType": "library",
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly --pretty --verbose",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
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
                    "outputs": [],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
              "libs/my-lib/nested-project": {
                "projectType": "library",
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly --pretty --verbose",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
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
                "projectType": "library",
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly --pretty --verbose",
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
                "projectType": "library",
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly --pretty --verbose",
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
                "projectType": "library",
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly --pretty --verbose",
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
                "projectType": "library",
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly --pretty --verbose",
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
                "projectType": "library",
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly --pretty --verbose",
                    "dependsOn": [
                      "^typecheck",
                    ],
                    "inputs": [
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
                      "{workspaceRoot}/dist/out-tsc/libs/my-lib/specs",
                      "{workspaceRoot}/dist/out-tsc/libs/my-lib/cypress",
                    ],
                    "syncGenerators": [
                      "@nx/js:typescript-sync",
                    ],
                  },
                },
              },
              "libs/my-lib/nested-project": {
                "projectType": "library",
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly --pretty --verbose",
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
                      "{workspaceRoot}/dist/out-tsc/libs/my-lib/nested-project",
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
                "projectType": "library",
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly --pretty --verbose",
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
                "projectType": "library",
                "targets": {
                  "typecheck": {
                    "cache": true,
                    "command": "tsc --build --emitDeclarationOnly --pretty --verbose",
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
    });
  });

  describe('build target', () => {
    it('should not create a node with a build target for a project level tsconfig files by default', async () => {
      // Sibling package.json
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{}`,
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
              "projectType": "library",
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
              "projectType": "library",
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
        'libs/my-lib/tsconfig.lib.json': `{}`,
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
              "projectType": "library",
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
              "projectType": "library",
              "targets": {},
            },
          },
        }
      `);
    });

    it('should create a node with a build target when enabled, for a project level tsconfig.lib.json build file by default', async () => {
      // Sibling package.json
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{}`,
        'libs/my-lib/tsconfig.build.json': `{}`,
        'libs/my-lib/package.json': `{}`,
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
              "projectType": "library",
              "targets": {
                "build": {
                  "cache": true,
                  "command": "tsc --build tsconfig.lib.json --pretty --verbose",
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
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{}`,
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
              "projectType": "library",
              "targets": {
                "build": {
                  "cache": true,
                  "command": "tsc --build tsconfig.lib.json --pretty --verbose",
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

    it('should create a node with a build target when enabled, using a custom configured target name', async () => {
      // Sibling package.json
      await applyFilesToTempFsAndContext(tempFs, context, {
        'libs/my-lib/tsconfig.json': `{}`,
        'libs/my-lib/tsconfig.lib.json': `{}`,
        'libs/my-lib/tsconfig.build.json': `{}`,
        'libs/my-lib/package.json': `{}`,
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
              "projectType": "library",
              "targets": {
                "my-build": {
                  "cache": true,
                  "command": "tsc --build tsconfig.lib.json --pretty --verbose",
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

    it('should create a node with a build target when enabled, using a custom configured tsconfig file', async () => {
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
          build: {
            configName: 'tsconfig.build.json',
          },
        })
      ).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/my-lib": {
              "projectType": "library",
              "targets": {
                "build": {
                  "cache": true,
                  "command": "tsc --build tsconfig.build.json --pretty --verbose",
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
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.spec.ts'],
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
                "projectType": "library",
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json --pretty --verbose",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
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

      it('should add extended config files', async () => {
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
          }),
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
                "projectType": "library",
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json --pretty --verbose",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
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

      it('should add files from internal project references', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': '{}',
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            include: ['src/**/*.ts'],
            exclude: ['src/**/foo.ts'], // should be ignored because a referenced internal project includes this same pattern
            references: [
              { path: './tsconfig.other.json' },
              { path: '../other-lib' }, // external project reference, it causes `dependentTasksOutputFiles` to be set
            ],
          }),
          'libs/my-lib/tsconfig.other.json': JSON.stringify({
            include: ['other/**/*.ts', 'src/**/foo.ts'],
          }),
          'libs/other-lib/tsconfig.json': JSON.stringify({
            include: ['**/*.ts'], // different pattern that should not be included because it's an external project
          }),
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
                "projectType": "library",
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json --pretty --verbose",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
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

      it('should only add exclude paths that are not part of other tsconfig files include paths', async () => {
        // exact match
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.json': '{}',
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            include: ['src/**/*.ts'],
            exclude: ['src/**/foo.ts'], // should be ignored
            references: [{ path: './tsconfig.other.json' }],
          }),
          'libs/my-lib/tsconfig.other.json': JSON.stringify({
            include: ['other/**/*.ts', 'src/**/foo.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });

        let result = await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        });
        expect(result.projects['libs/my-lib'].targets.build.inputs)
          .toMatchInlineSnapshot(`
          [
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
            include: ['**/*.ts'],
            exclude: ['**/foo.ts'], // should be ignored
            references: [{ path: './tsconfig.other.json' }],
          }),
          'libs/my-lib/tsconfig.other.json': JSON.stringify({
            include: ['other/**/*.ts', 'src/**/foo.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });
        result = await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        });
        expect(result.projects['libs/my-lib'].targets.build.inputs)
          .toMatchInlineSnapshot(`
          [
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
            include: ['src/**/*.ts'],
            exclude: ['src/**/foo.ts'], // should be ignored
            references: [{ path: './tsconfig.other.json' }],
          }),
          'libs/my-lib/tsconfig.other.json': JSON.stringify({
            include: ['other/**/*.ts', '**/foo.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });
        result = await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        });
        expect(result.projects['libs/my-lib'].targets.build.inputs)
          .toMatchInlineSnapshot(`
          [
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
            include: ['src/**/*.ts'],
            exclude: ['src/**/foo.ts'], // should be ignored
            references: [{ path: './tsconfig.other.json' }],
          }),
          'libs/my-lib/tsconfig.other.json': JSON.stringify({
            include: ['./other/**/*.ts', './**/foo.ts'],
          }),
          'libs/my-lib/package.json': `{}`,
        });
        result = await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        });
        expect(result.projects['libs/my-lib'].targets.build.inputs)
          .toMatchInlineSnapshot(`
          [
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
          'libs/my-lib/package.json': `{}`,
        });
        result = await invokeCreateNodesOnMatchingFiles(context, {
          typecheck: false,
          build: true,
        });
        expect(result.projects['libs/my-lib'].targets.build.inputs)
          .toMatchInlineSnapshot(`
          [
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
                "projectType": "library",
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json --pretty --verbose",
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
    });

    describe('outputs', () => {
      it('should add the `outFile`', async () => {
        await applyFilesToTempFsAndContext(tempFs, context, {
          'libs/my-lib/tsconfig.lib.json': JSON.stringify({
            compilerOptions: { outFile: '../../dist/libs/my-lib/index.js' },
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
                "projectType": "library",
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json --pretty --verbose",
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
            compilerOptions: { outDir: '../../dist/libs/my-lib' },
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
                "projectType": "library",
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json --pretty --verbose",
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
                "projectType": "library",
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json --pretty --verbose",
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
            compilerOptions: { outFile: '../../dist/libs/my-lib/lib.js' },
            files: ['main.ts'],
            references: [{ path: './tsconfig.other.json' }],
          }),
          'libs/my-lib/tsconfig.other.json': JSON.stringify({
            compilerOptions: { outDir: '../../dist/libs/my-lib/other' },
            include: ['other/**/*.ts'],
          }),
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
                "projectType": "library",
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json --pretty --verbose",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
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
                "projectType": "library",
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json --pretty --verbose",
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
                "projectType": "library",
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "tsc --build tsconfig.lib.json --pretty --verbose",
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
    minimatch(file, createNodesV2[0], { dot: true })
  );
  setupWorkspaceContext(tempFs.tempDir);
}

async function invokeCreateNodesOnMatchingFiles(
  context: CreateNodesContext,
  pluginOptions: TscPluginOptions
) {
  const aggregateProjects: Record<string, any> = {};
  for (const file of context.configFiles) {
    const results = await createNodesV2[1]([file], pluginOptions, context);
    for (const [, nodes] of results) {
      for (const [projectName, project] of Object.entries(
        nodes.projects ?? {}
      )) {
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
  }
  return {
    projects: aggregateProjects,
  };
}
