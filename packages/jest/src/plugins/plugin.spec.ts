import { CreateNodesContext } from '@nx/devkit';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { join } from 'path';
import { createNodesV2 } from './plugin';

jest.mock('nx/src/utils/cache-directory', () => ({
  ...jest.requireActual('nx/src/utils/cache-directory'),
  workspaceDataDirectory: 'tmp/project-graph-cache',
}));

describe('@nx/jest/plugin', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;
  let cwd: string;

  beforeEach(async () => {
    tempFs = new TempFs('test');
    cwd = process.cwd();
    process.chdir(tempFs.tempDir);
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

    await tempFs.createFiles({
      'proj/jest.config.js': `module.exports = {}`,
      'proj/src/unit.spec.ts': '',
      'proj/src/ignore.spec.ts': '',
      'proj/project.json': '{}',
    });
  });

  afterEach(() => {
    jest.resetModules();
    tempFs.cleanup();
    process.chdir(cwd);
  });

  it('should create nodes based on jest.config.ts', async () => {
    mockJestConfig(
      {
        coverageDirectory: '../coverage',
      },
      context
    );
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      {
        targetName: 'test',
      },
      context
    );

    expect(results).toMatchInlineSnapshot(`
      [
        [
          "proj/jest.config.js",
          {
            "projects": {
              "proj": {
                "metadata": undefined,
                "root": "proj",
                "targets": {
                  "test": {
                    "cache": true,
                    "command": "jest",
                    "inputs": [
                      "default",
                      "^production",
                      {
                        "externalDependencies": [
                          "jest",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run Jest Tests",
                      "help": {
                        "command": "npx jest --help",
                        "example": {
                          "options": {
                            "coverage": true,
                          },
                        },
                      },
                      "technologies": [
                        "jest",
                      ],
                    },
                    "options": {
                      "cwd": "proj",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"moduleResolution":"node10"}",
                      },
                    },
                    "outputs": [
                      "{workspaceRoot}/coverage",
                    ],
                  },
                },
              },
            },
          },
        ],
      ]
    `);
  });

  it('should create test-ci targets based on jest.config.ts', async () => {
    mockJestConfig(
      {
        coverageDirectory: '../coverage',
        testMatch: ['**/*.spec.ts'],
        testPathIgnorePatterns: ['ignore.spec.ts'],
      },
      context
    );
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      {
        targetName: 'test',
        ciTargetName: 'test-ci',
      },
      context
    );

    expect(results).toMatchInlineSnapshot(`
      [
        [
          "proj/jest.config.js",
          {
            "projects": {
              "proj": {
                "metadata": {
                  "targetGroups": {
                    "E2E (CI)": [
                      "test-ci",
                      "test-ci--src/unit.spec.ts",
                    ],
                  },
                },
                "root": "proj",
                "targets": {
                  "test": {
                    "cache": true,
                    "command": "jest",
                    "inputs": [
                      "default",
                      "^production",
                      {
                        "externalDependencies": [
                          "jest",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run Jest Tests",
                      "help": {
                        "command": "npx jest --help",
                        "example": {
                          "options": {
                            "coverage": true,
                          },
                        },
                      },
                      "technologies": [
                        "jest",
                      ],
                    },
                    "options": {
                      "cwd": "proj",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"moduleResolution":"node10"}",
                      },
                    },
                    "outputs": [
                      "{workspaceRoot}/coverage",
                    ],
                  },
                  "test-ci": {
                    "cache": true,
                    "dependsOn": [
                      "test-ci--src/unit.spec.ts",
                    ],
                    "executor": "nx:noop",
                    "inputs": [
                      "default",
                      "^production",
                      {
                        "externalDependencies": [
                          "jest",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run Jest Tests in CI",
                      "help": {
                        "command": "npx jest --help",
                        "example": {
                          "options": {
                            "coverage": true,
                          },
                        },
                      },
                      "nonAtomizedTarget": "test",
                      "technologies": [
                        "jest",
                      ],
                    },
                    "outputs": [
                      "{workspaceRoot}/coverage",
                    ],
                  },
                  "test-ci--src/unit.spec.ts": {
                    "cache": true,
                    "command": "jest src/unit.spec.ts",
                    "inputs": [
                      "default",
                      "^production",
                      {
                        "externalDependencies": [
                          "jest",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run Jest Tests in src/unit.spec.ts",
                      "help": {
                        "command": "npx jest --help",
                        "example": {
                          "options": {
                            "coverage": true,
                          },
                        },
                      },
                      "technologies": [
                        "jest",
                      ],
                    },
                    "options": {
                      "cwd": "proj",
                    },
                    "outputs": [
                      "{workspaceRoot}/coverage",
                    ],
                  },
                },
              },
            },
          },
        ],
      ]
    `);
  });

  it('should add preset to the inputs', async () => {
    mockJestConfig(
      { coverageDirectory: '../coverage', preset: '../jest.preset.js' },
      context
    );
    tempFs.createFileSync('jest.preset.js', 'module.exports = {};');

    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test' },
      context
    );

    expect(results).toMatchInlineSnapshot(`
      [
        [
          "proj/jest.config.js",
          {
            "projects": {
              "proj": {
                "metadata": undefined,
                "root": "proj",
                "targets": {
                  "test": {
                    "cache": true,
                    "command": "jest",
                    "inputs": [
                      "default",
                      "^production",
                      "{workspaceRoot}/jest.preset.js",
                      {
                        "externalDependencies": [
                          "jest",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run Jest Tests",
                      "help": {
                        "command": "npx jest --help",
                        "example": {
                          "options": {
                            "coverage": true,
                          },
                        },
                      },
                      "technologies": [
                        "jest",
                      ],
                    },
                    "options": {
                      "cwd": "proj",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"moduleResolution":"node10"}",
                      },
                    },
                    "outputs": [
                      "{workspaceRoot}/coverage",
                    ],
                  },
                },
              },
            },
          },
        ],
      ]
    `);
  });

  it.each`
    presetFileName        | content
    ${'jest-preset.json'} | ${'{}'}
    ${'jest-preset.js'}   | ${'module.exports = {};'}
    ${'jest-preset.cjs'}  | ${'module.exports = {};'}
  `(
    'should add package as externalDependencies to the inputs when specified as preset and containing a $presetFileName file',
    async ({ presetFileName, content }) => {
      mockJestConfig(
        { coverageDirectory: '../coverage', preset: 'some-package' },
        context
      );
      await tempFs.createFiles({
        [`node_modules/some-package/${presetFileName}`]: content,
        'node_modules/some-package/package.json':
          '{ "name": "some-package", "version": "1.0.0" }',
      });

      const results = await createNodesFunction(
        ['proj/jest.config.js'],
        { targetName: 'test' },
        context
      );

      expect(results).toMatchSnapshot();
    }
  );

  describe('disableJestRuntime', () => {
    it('should create test and test-ci targets based on jest.config.ts', async () => {
      mockJestConfig(
        {
          coverageDirectory: '../coverage',
          testMatch: ['**/*.spec.ts'],
          testPathIgnorePatterns: ['ignore.spec.ts'],
        },
        context
      );
      const results = await createNodesFunction(
        ['proj/jest.config.js'],
        {
          targetName: 'test',
          ciTargetName: 'test-ci',
          disableJestRuntime: true,
        },
        context
      );

      expect(results).toMatchInlineSnapshot(`
      [
        [
          "proj/jest.config.js",
          {
            "projects": {
              "proj": {
                "metadata": {
                  "targetGroups": {
                    "E2E (CI)": [
                      "test-ci",
                      "test-ci--src/unit.spec.ts",
                    ],
                  },
                },
                "root": "proj",
                "targets": {
                  "test": {
                    "cache": true,
                    "command": "jest",
                    "inputs": [
                      "default",
                      "^production",
                      {
                        "externalDependencies": [
                          "jest",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run Jest Tests",
                      "help": {
                        "command": "npx jest --help",
                        "example": {
                          "options": {
                            "coverage": true,
                          },
                        },
                      },
                      "technologies": [
                        "jest",
                      ],
                    },
                    "options": {
                      "cwd": "proj",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"moduleResolution":"node10"}",
                      },
                    },
                    "outputs": [
                      "{workspaceRoot}/coverage",
                    ],
                  },
                  "test-ci": {
                    "cache": true,
                    "dependsOn": [
                      "test-ci--src/unit.spec.ts",
                    ],
                    "executor": "nx:noop",
                    "inputs": [
                      "default",
                      "^production",
                      {
                        "externalDependencies": [
                          "jest",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run Jest Tests in CI",
                      "help": {
                        "command": "npx jest --help",
                        "example": {
                          "options": {
                            "coverage": true,
                          },
                        },
                      },
                      "nonAtomizedTarget": "test",
                      "technologies": [
                        "jest",
                      ],
                    },
                    "outputs": [
                      "{workspaceRoot}/coverage",
                    ],
                  },
                  "test-ci--src/unit.spec.ts": {
                    "cache": true,
                    "command": "jest src/unit.spec.ts",
                    "inputs": [
                      "default",
                      "^production",
                      {
                        "externalDependencies": [
                          "jest",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run Jest Tests in src/unit.spec.ts",
                      "help": {
                        "command": "npx jest --help",
                        "example": {
                          "options": {
                            "coverage": true,
                          },
                        },
                      },
                      "technologies": [
                        "jest",
                      ],
                    },
                    "options": {
                      "cwd": "proj",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"moduleResolution":"node10"}",
                      },
                    },
                    "outputs": [
                      "{workspaceRoot}/coverage",
                    ],
                  },
                },
              },
            },
          },
        ],
      ]
    `);
    });

    it.each`
      preset                        | expectedInput
      ${'<rootDir>/jest.preset.js'} | ${'{projectRoot}/jest.preset.js'}
      ${'../jest.preset.js'}        | ${'{workspaceRoot}/jest.preset.js'}
    `('should correct input from preset', async ({ preset, expectedInput }) => {
      mockJestConfig(
        {
          preset,
          coverageDirectory: '../coverage',
          testMatch: ['**/*.spec.ts'],
          testPathIgnorePatterns: ['ignore.spec.ts'],
        },
        context
      );
      const results = await createNodesFunction(
        ['proj/jest.config.js'],
        {
          targetName: 'test',
          ciTargetName: 'test-ci',
          disableJestRuntime: true,
        },
        context
      );

      expect(results[0][1].projects['proj'].targets['test'].inputs).toContain(
        expectedInput
      );
    });

    it.each`
      testRegex
      ${'\\.*\\.spec\\.ts'}
      ${['\\.*\\.spec\\.ts']}
    `(
      'should create test-ci targets from testRegex config option',
      async ({ testRegex }) => {
        mockJestConfig(
          {
            coverageDirectory: '../coverage',
            testRegex,
            testPathIgnorePatterns: ['ignore.spec.ts'],
          },
          context
        );
        const results = await createNodesFunction(
          ['proj/jest.config.js'],
          {
            targetName: 'test',
            ciTargetName: 'test-ci',
            disableJestRuntime: true,
          },
          context
        );

        expect(results).toMatchInlineSnapshot(`
      [
        [
          "proj/jest.config.js",
          {
            "projects": {
              "proj": {
                "metadata": {
                  "targetGroups": {
                    "E2E (CI)": [
                      "test-ci",
                      "test-ci--src/unit.spec.ts",
                    ],
                  },
                },
                "root": "proj",
                "targets": {
                  "test": {
                    "cache": true,
                    "command": "jest",
                    "inputs": [
                      "default",
                      "^production",
                      {
                        "externalDependencies": [
                          "jest",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run Jest Tests",
                      "help": {
                        "command": "npx jest --help",
                        "example": {
                          "options": {
                            "coverage": true,
                          },
                        },
                      },
                      "technologies": [
                        "jest",
                      ],
                    },
                    "options": {
                      "cwd": "proj",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"moduleResolution":"node10"}",
                      },
                    },
                    "outputs": [
                      "{workspaceRoot}/coverage",
                    ],
                  },
                  "test-ci": {
                    "cache": true,
                    "dependsOn": [
                      "test-ci--src/unit.spec.ts",
                    ],
                    "executor": "nx:noop",
                    "inputs": [
                      "default",
                      "^production",
                      {
                        "externalDependencies": [
                          "jest",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run Jest Tests in CI",
                      "help": {
                        "command": "npx jest --help",
                        "example": {
                          "options": {
                            "coverage": true,
                          },
                        },
                      },
                      "nonAtomizedTarget": "test",
                      "technologies": [
                        "jest",
                      ],
                    },
                    "outputs": [
                      "{workspaceRoot}/coverage",
                    ],
                  },
                  "test-ci--src/unit.spec.ts": {
                    "cache": true,
                    "command": "jest src/unit.spec.ts",
                    "inputs": [
                      "default",
                      "^production",
                      {
                        "externalDependencies": [
                          "jest",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run Jest Tests in src/unit.spec.ts",
                      "help": {
                        "command": "npx jest --help",
                        "example": {
                          "options": {
                            "coverage": true,
                          },
                        },
                      },
                      "technologies": [
                        "jest",
                      ],
                    },
                    "options": {
                      "cwd": "proj",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"moduleResolution":"node10"}",
                      },
                    },
                    "outputs": [
                      "{workspaceRoot}/coverage",
                    ],
                  },
                },
              },
            },
          },
        ],
      ]
    `);
      }
    );
  });
});

function mockJestConfig(config: any, context: CreateNodesContext) {
  jest.mock(join(context.workspaceRoot, 'proj/jest.config.js'), () => config, {
    virtual: true,
  });
}
