import { CreateNodesContextV2 } from '@nx/devkit';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { join } from 'path';
import { createNodesV2 } from './plugin';

jest.mock('nx/src/utils/cache-directory', () => ({
  ...jest.requireActual('nx/src/utils/cache-directory'),
  workspaceDataDirectory: 'tmp/project-graph-cache',
}));

describe.each([true, false])('@nx/jest/plugin', (disableJestRuntime) => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContextV2;
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
        disableJestRuntime,
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
                        "TS_NODE_COMPILER_OPTIONS": "{"moduleResolution":"node10","module":"commonjs","customConditions":null}",
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
        disableJestRuntime,
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
                    "TEST (CI)": [
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
                        "TS_NODE_COMPILER_OPTIONS": "{"moduleResolution":"node10","module":"commonjs","customConditions":null}",
                      },
                    },
                    "outputs": [
                      "{workspaceRoot}/coverage",
                    ],
                  },
                  "test-ci": {
                    "cache": true,
                    "dependsOn": [
                      {
                        "options": "forward",
                        "params": "forward",
                        "projects": "self",
                        "target": "test-ci--src/unit.spec.ts",
                      },
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
                        "TS_NODE_COMPILER_OPTIONS": "{"moduleResolution":"node10","module":"commonjs","customConditions":null}",
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

  it('should add preset to the inputs', async () => {
    mockJestConfig(
      { coverageDirectory: '../coverage', preset: '../jest.preset.js' },
      context
    );
    tempFs.createFileSync('jest.preset.js', 'module.exports = {};');

    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime },
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
                        "TS_NODE_COMPILER_OPTIONS": "{"moduleResolution":"node10","module":"commonjs","customConditions":null}",
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
        { targetName: 'test', disableJestRuntime },
        context
      );

      const snapshot = `
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
                          "some-package",
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
                        "TS_NODE_COMPILER_OPTIONS": "{"moduleResolution":"node10","module":"commonjs","customConditions":null}",
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
    `;
      expect(results).toMatchInlineSnapshot(snapshot);
    }
  );

  describe('ciGroupName', () => {
    it('should name atomized tasks group using provided group name', async () => {
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
          ciTargetName: 'test-ci',
          ciGroupName: 'MY ATOMIZED TEST TASKS (CI)',
          disableJestRuntime,
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
                      "MY ATOMIZED TEST TASKS (CI)": [
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
                          "TS_NODE_COMPILER_OPTIONS": "{"moduleResolution":"node10","module":"commonjs","customConditions":null}",
                        },
                      },
                      "outputs": [
                        "{workspaceRoot}/coverage",
                      ],
                    },
                    "test-ci": {
                      "cache": true,
                      "dependsOn": [
                        {
                          "options": "forward",
                          "params": "forward",
                          "projects": "self",
                          "target": "test-ci--src/unit.spec.ts",
                        },
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
                          "TS_NODE_COMPILER_OPTIONS": "{"moduleResolution":"node10","module":"commonjs","customConditions":null}",
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

    it('should deduct atomized tasks group name (from ci target name) when not explicitly provided', async () => {
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
          ciTargetName: 'test-ci',
          disableJestRuntime,
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
                      "TEST (CI)": [
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
                          "TS_NODE_COMPILER_OPTIONS": "{"moduleResolution":"node10","module":"commonjs","customConditions":null}",
                        },
                      },
                      "outputs": [
                        "{workspaceRoot}/coverage",
                      ],
                    },
                    "test-ci": {
                      "cache": true,
                      "dependsOn": [
                        {
                          "options": "forward",
                          "params": "forward",
                          "projects": "self",
                          "target": "test-ci--src/unit.spec.ts",
                        },
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
                          "TS_NODE_COMPILER_OPTIONS": "{"moduleResolution":"node10","module":"commonjs","customConditions":null}",
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

    it('should default to "${ciTargetName.toUpperCase()} (CI)" when group name cannot be automatically deducted from ci target name', async () => {
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
          ciTargetName: 'testci', // missing "-ci" suffix or similar construct, so group name cannot reliably be deducted from ci target name
          disableJestRuntime,
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
                      "TESTCI (CI)": [
                        "testci",
                        "testci--src/unit.spec.ts",
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
                          "TS_NODE_COMPILER_OPTIONS": "{"moduleResolution":"node10","module":"commonjs","customConditions":null}",
                        },
                      },
                      "outputs": [
                        "{workspaceRoot}/coverage",
                      ],
                    },
                    "testci": {
                      "cache": true,
                      "dependsOn": [
                        {
                          "options": "forward",
                          "params": "forward",
                          "projects": "self",
                          "target": "testci--src/unit.spec.ts",
                        },
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
                    "testci--src/unit.spec.ts": {
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
                          "TS_NODE_COMPILER_OPTIONS": "{"moduleResolution":"node10","module":"commonjs","customConditions":null}",
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
  });
});

describe('@nx/jest/plugin config file inputs', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContextV2;
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
    };

    await tempFs.createFiles({
      'proj/jest.config.js': `module.exports = {}`,
      'proj/src/unit.spec.ts': '',
      'proj/project.json': '{}',
    });
  });

  afterEach(() => {
    jest.resetModules();
    tempFs.cleanup();
    process.chdir(cwd);
  });

  function mockConfig(config: any) {
    jest.mock(
      join(context.workspaceRoot, 'proj/jest.config.js'),
      () => config,
      { virtual: true }
    );
  }

  function getTestInputs(results: any) {
    return results[0][1].projects['proj'].targets['test'].inputs;
  }

  it('should resolve resolver from config as file input', async () => {
    await tempFs.createFiles({ 'custom-resolver.js': '' });
    mockConfig({ resolver: '../custom-resolver.js' });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    expect(getTestInputs(results)).toContainEqual(
      '{workspaceRoot}/custom-resolver.js'
    );
  });

  it('should resolve resolver as npm package to external dependency', async () => {
    mockConfig({ resolver: 'jest-resolver-enhanced' });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    expect(getTestInputs(results)).toContainEqual(
      expect.objectContaining({
        externalDependencies: expect.arrayContaining([
          'jest-resolver-enhanced',
        ]),
      })
    );
  });

  it('should resolve resolver from preset when not in config', async () => {
    await tempFs.createFiles({
      'jest.preset.js': `module.exports = { resolver: '../scripts/custom-resolver.js' };`,
      'scripts/custom-resolver.js': '',
    });
    mockConfig({ preset: '../jest.preset.js' });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    expect(getTestInputs(results)).toContainEqual(
      '{workspaceRoot}/scripts/custom-resolver.js'
    );
  });

  it('should resolve setupFiles concatenated from preset and config', async () => {
    await tempFs.createFiles({
      'jest.preset.js': `module.exports = { setupFiles: ['../scripts/preset-setup.js'] };`,
      'scripts/preset-setup.js': '',
      'proj/local-setup.js': '',
    });
    mockConfig({
      preset: '../jest.preset.js',
      setupFiles: ['./local-setup.js'],
    });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    const inputs = getTestInputs(results);
    expect(inputs).toContainEqual('{workspaceRoot}/scripts/preset-setup.js');
    expect(inputs).toContainEqual('{projectRoot}/local-setup.js');
  });

  it('should resolve setupFilesAfterEnv with <rootDir> prefix', async () => {
    await tempFs.createFiles({ 'scripts/test-setup.js': '' });
    mockConfig({
      setupFilesAfterEnv: ['<rootDir>/../scripts/test-setup.js'],
    });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    expect(getTestInputs(results)).toContainEqual(
      '{workspaceRoot}/scripts/test-setup.js'
    );
  });

  it('should resolve globalSetup and globalTeardown as file inputs', async () => {
    await tempFs.createFiles({
      'scripts/global-setup.js': '',
      'scripts/global-teardown.js': '',
    });
    mockConfig({
      globalSetup: '../scripts/global-setup.js',
      globalTeardown: '../scripts/global-teardown.js',
    });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    const inputs = getTestInputs(results);
    expect(inputs).toContainEqual('{workspaceRoot}/scripts/global-setup.js');
    expect(inputs).toContainEqual('{workspaceRoot}/scripts/global-teardown.js');
  });

  it('should resolve moduleNameMapper file values and skip backreferences', async () => {
    await tempFs.createFiles({ 'scripts/mock-file.js': '' });
    mockConfig({
      moduleNameMapper: {
        '^module$': '../scripts/mock-file.js',
        '^@app/(.*)$': '<rootDir>/src/$1',
      },
    });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    const inputs = getTestInputs(results);
    expect(inputs).toContainEqual('{workspaceRoot}/scripts/mock-file.js');
    const fileInputStrings = inputs.filter((i: any) => typeof i === 'string');
    expect(fileInputStrings).not.toContainEqual(expect.stringContaining('$1'));
  });

  it('should resolve moduleNameMapper array values', async () => {
    await tempFs.createFiles({
      'scripts/mock-a.js': '',
      'scripts/mock-b.js': '',
    });
    mockConfig({
      moduleNameMapper: {
        '^module$': ['../scripts/mock-a.js', '../scripts/mock-b.js'],
      },
    });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    const inputs = getTestInputs(results);
    expect(inputs).toContainEqual('{workspaceRoot}/scripts/mock-a.js');
    expect(inputs).toContainEqual('{workspaceRoot}/scripts/mock-b.js');
  });

  it('should resolve transform npm package as external dependency', async () => {
    mockConfig({ transform: { '^.+\\.ts$': 'ts-jest' } });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    expect(getTestInputs(results)).toContainEqual(
      expect.objectContaining({
        externalDependencies: expect.arrayContaining(['ts-jest']),
      })
    );
  });

  it('should resolve transform tuple value', async () => {
    mockConfig({
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
      },
    });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    expect(getTestInputs(results)).toContainEqual(
      expect.objectContaining({
        externalDependencies: expect.arrayContaining(['ts-jest']),
      })
    );
  });

  it('should deduplicate inputs from multiple properties', async () => {
    mockConfig({
      resolver: 'jest-resolver-enhanced',
      transform: { '^.+\\.ts$': 'jest-resolver-enhanced' },
    });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    const inputs = getTestInputs(results);
    const extDepsInputs = inputs.filter(
      (i: any) => typeof i === 'object' && 'externalDependencies' in i
    );
    expect(extDepsInputs).toHaveLength(1);
    const allExtDeps = extDepsInputs[0].externalDependencies;
    const enhancedCount = allExtDeps.filter(
      (d: string) => d === 'jest-resolver-enhanced'
    ).length;
    expect(enhancedCount).toBe(1);
  });

  it('should resolve moduleNameMapper <rootDir> to correct scoped package name', async () => {
    await tempFs.createFiles({
      'node_modules/@schematics/angular/package.json':
        '{ "name": "@schematics/angular", "version": "1.0.0" }',
      'node_modules/@schematics/angular/collection.json': '{}',
    });
    mockConfig({
      moduleNameMapper: {
        '^@schematics/angular$':
          '<rootDir>/../node_modules/@schematics/angular/collection.json',
      },
    });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    expect(getTestInputs(results)).toContainEqual(
      expect.objectContaining({
        externalDependencies: expect.arrayContaining(['@schematics/angular']),
      })
    );
  });

  it('should resolve snapshotResolver as local file', async () => {
    await tempFs.createFiles({ 'proj/snapshot-resolver.js': '' });
    mockConfig({ snapshotResolver: './snapshot-resolver.js' });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    expect(getTestInputs(results)).toContainEqual(
      '{projectRoot}/snapshot-resolver.js'
    );
  });

  it('should resolve runner as npm package', async () => {
    mockConfig({ runner: 'jest-runner-eslint' });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    expect(getTestInputs(results)).toContainEqual(
      expect.objectContaining({
        externalDependencies: expect.arrayContaining(['jest-runner-eslint']),
      })
    );
  });

  it('should resolve runner shorthand with jest-runner- prefix', async () => {
    mockConfig({ runner: 'eslint' });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    expect(getTestInputs(results)).toContainEqual(
      expect.objectContaining({
        externalDependencies: expect.arrayContaining(['jest-runner-eslint']),
      })
    );
  });

  it('should resolve watchPlugins shorthand with jest-watch- prefix', async () => {
    mockConfig({
      watchPlugins: ['typeahead', 'master'],
    });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    const inputs = getTestInputs(results);
    expect(inputs).toContainEqual(
      expect.objectContaining({
        externalDependencies: expect.arrayContaining(['jest-watch-typeahead']),
      })
    );
    expect(inputs).toContainEqual(
      expect.objectContaining({
        externalDependencies: expect.arrayContaining(['jest-watch-master']),
      })
    );
  });

  it('should resolve testResultsProcessor as npm package', async () => {
    mockConfig({ testResultsProcessor: 'jest-sonar-reporter' });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    expect(getTestInputs(results)).toContainEqual(
      expect.objectContaining({
        externalDependencies: expect.arrayContaining(['jest-sonar-reporter']),
      })
    );
  });

  it('should resolve reporters with tuple format and skip built-ins', async () => {
    mockConfig({
      reporters: [
        'default',
        'summary',
        ['jest-junit', { outputDirectory: 'reports' }],
      ],
    });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    const inputs = getTestInputs(results);
    expect(inputs).toContainEqual(
      expect.objectContaining({
        externalDependencies: expect.arrayContaining(['jest-junit']),
      })
    );
    const allExtDeps = inputs
      .filter((i: any) => typeof i === 'object' && 'externalDependencies' in i)
      .flatMap((i: any) => i.externalDependencies);
    expect(allExtDeps).not.toContain('default');
    expect(allExtDeps).not.toContain('summary');
  });

  it('should resolve watchPlugins with tuple format', async () => {
    mockConfig({
      watchPlugins: [
        ['jest-watch-typeahead/filename', { key: 'p' }],
        'jest-watch-master',
      ],
    });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    const inputs = getTestInputs(results);
    expect(inputs).toContainEqual(
      expect.objectContaining({
        externalDependencies: expect.arrayContaining(['jest-watch-typeahead']),
      })
    );
    expect(inputs).toContainEqual(
      expect.objectContaining({
        externalDependencies: expect.arrayContaining(['jest-watch-master']),
      })
    );
  });

  it('should resolve snapshotSerializers as replaced array', async () => {
    mockConfig({
      snapshotSerializers: ['jest-serializer-html'],
    });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    expect(getTestInputs(results)).toContainEqual(
      expect.objectContaining({
        externalDependencies: expect.arrayContaining(['jest-serializer-html']),
      })
    );
  });

  it('should load preset from npm package', async () => {
    await tempFs.createFiles({
      'node_modules/my-jest-preset/jest-preset.js':
        'module.exports = { setupFiles: [] };',
      'node_modules/my-jest-preset/package.json':
        '{ "name": "my-jest-preset", "version": "1.0.0" }',
    });
    mockConfig({ preset: 'my-jest-preset' });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    expect(getTestInputs(results)).toContainEqual(
      expect.objectContaining({
        externalDependencies: expect.arrayContaining(['my-jest-preset']),
      })
    );
  });

  it('should resolve paths relative to custom rootDir', async () => {
    await tempFs.createFiles({
      'shared/setup.js': '',
    });
    mockConfig({
      rootDir: '../shared',
      setupFiles: ['./setup.js'],
    });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    expect(getTestInputs(results)).toContainEqual(
      '{workspaceRoot}/shared/setup.js'
    );
  });

  it('should resolve preset with <rootDir> prefix', async () => {
    await tempFs.createFiles({
      'shared/jest.preset.js':
        'module.exports = { globalSetup: "./global-setup.js" };',
      'shared/global-setup.js': '',
      'proj/global-setup.js': '',
    });
    mockConfig({
      preset: '<rootDir>/../shared/jest.preset.js',
    });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    // Preset is resolved via <rootDir>, so it should appear as an input
    expect(getTestInputs(results)).toContainEqual(
      '{workspaceRoot}/shared/jest.preset.js'
    );
    // globalSetup from preset resolves relative to rootDir (proj/),
    // matching Jest's behavior
    expect(getTestInputs(results)).toContainEqual(
      '{projectRoot}/global-setup.js'
    );
  });

  it('should use jest-resolve when useJestResolver is true', async () => {
    await tempFs.createFiles({
      'node_modules/my-jest-preset/jest-preset.js':
        'module.exports = { setupFiles: [] };',
      'node_modules/my-jest-preset/package.json':
        '{ "name": "my-jest-preset", "version": "1.0.0" }',
    });
    mockConfig({ preset: 'my-jest-preset' });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true, useJestResolver: true },
      context
    );
    expect(getTestInputs(results)).toContainEqual(
      expect.objectContaining({
        externalDependencies: expect.arrayContaining(['my-jest-preset']),
      })
    );
  });

  it('should classify workspace-linked preset as file input when using jest resolver', async () => {
    await tempFs.createFiles({
      'libs/my-preset/jest-preset.js': 'module.exports = {};',
      'libs/my-preset/package.json':
        '{ "name": "@my-org/jest-preset", "version": "0.0.0" }',
      'node_modules/@my-org/jest-preset': '',
    });
    // Simulate a workspace-linked package via symlink
    const fs = await import('fs');
    fs.rmSync(join(tempFs.tempDir, 'node_modules/@my-org/jest-preset'));
    fs.mkdirSync(join(tempFs.tempDir, 'node_modules/@my-org'), {
      recursive: true,
    });
    fs.symlinkSync(
      join(tempFs.tempDir, 'libs/my-preset'),
      join(tempFs.tempDir, 'node_modules/@my-org/jest-preset')
    );
    mockConfig({ preset: '@my-org/jest-preset' });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true, useJestResolver: true },
      context
    );
    const inputs = getTestInputs(results);
    // useJestResolver follows symlinks into the workspace
    expect(inputs).toContainEqual(
      expect.stringContaining('libs/my-preset/jest-preset.js')
    );
    const extDeps = inputs
      .filter((i: any) => typeof i === 'object' && 'externalDependencies' in i)
      .flatMap((i: any) => i.externalDependencies);
    expect(extDeps).not.toContain('@my-org/jest-preset');
  });

  it('should not crash when preset fails to load', async () => {
    mockConfig({
      preset: '../nonexistent-preset.js',
      setupFiles: ['./local-setup.js'],
    });
    await tempFs.createFiles({ 'proj/local-setup.js': '' });
    const results = await createNodesFunction(
      ['proj/jest.config.js'],
      { targetName: 'test', disableJestRuntime: true },
      context
    );
    const inputs = getTestInputs(results);
    expect(inputs).toContainEqual('{projectRoot}/local-setup.js');
  });
});

function mockJestConfig(config: any, context: CreateNodesContextV2) {
  jest.mock(join(context.workspaceRoot, 'proj/jest.config.js'), () => config, {
    virtual: true,
  });
}
