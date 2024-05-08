import { CreateNodesContext } from '@nx/devkit';
import { join } from 'path';

import { createNodes } from './plugin';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';

describe('@nx/jest/plugin', () => {
  let createNodesFunction = createNodes[1];
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

  test('foo', () => {});

  afterEach(() => {
    jest.resetModules();
    process.chdir(cwd);
  });

  it('should create nodes based on jest.config.ts', async () => {
    mockJestConfig(
      {
        coverageDirectory: '../coverage',
      },
      context
    );
    const nodes = await createNodesFunction(
      'proj/jest.config.js',
      {
        targetName: 'test',
      },
      context
    );

    expect(nodes.projects.proj).toMatchInlineSnapshot(`
      {
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
      }
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
    const nodes = await createNodesFunction(
      'proj/jest.config.js',
      {
        targetName: 'test',
        ciTargetName: 'test-ci',
      },
      context
    );

    expect(nodes.projects.proj).toMatchInlineSnapshot(`
      {
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
      }
    `);
  });
});

function mockJestConfig(config: any, context: CreateNodesContext) {
  jest.mock(join(context.workspaceRoot, 'proj/jest.config.js'), () => config, {
    virtual: true,
  });
}
