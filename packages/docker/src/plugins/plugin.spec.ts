import { CreateNodesContext } from '@nx/devkit';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { createNodesV2 } from './plugin';

jest.mock('nx/src/utils/cache-directory', () => ({
  ...jest.requireActual('nx/src/utils/cache-directory'),
  workspaceDataDirectory: 'tmp/project-graph-cache',
}));

describe('@nx/docker', () => {
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
  });

  afterEach(() => {
    jest.resetModules();
    tempFs.cleanup();
    process.chdir(cwd);
  });

  it('should create nodes based on Dockerfile', async () => {
    await tempFs.createFiles({
      'proj/Dockerfile': 'FROM node:18',
      'proj/project.json': '{}',
    });

    const results = await createNodesFunction(['proj/Dockerfile'], {}, context);

    expect(results).toMatchInlineSnapshot(`
      [
        [
          "proj/Dockerfile",
          {
            "projects": {
              "proj": {
                "metadata": {
                  "targetGroups": {
                    "Docker": [
                      "docker:build",
                      "docker:run",
                      "nx-release-publish",
                    ],
                  },
                },
                "root": "proj",
                "targets": {
                  "docker:build": {
                    "command": "docker build .",
                    "inputs": [
                      "production",
                      "^production",
                    ],
                    "metadata": {
                      "description": "Run Docker build",
                      "help": {
                        "command": "docker build --help",
                        "example": {
                          "options": {
                            "cache-from": "type=s3,region=eu-west-1,bucket=mybucket .",
                            "cache-to": "type=s3,region=eu-west-1,bucket=mybucket .",
                          },
                        },
                      },
                      "technologies": [
                        "docker",
                      ],
                    },
                    "options": {
                      "args": [
                        "--tag proj",
                      ],
                      "cwd": "proj",
                    },
                  },
                  "docker:run": {
                    "command": "docker run {args} proj",
                    "dependsOn": [
                      "docker:build",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                    ],
                    "metadata": {
                      "description": "Run Docker run",
                      "help": {
                        "command": "docker run --help",
                        "example": {
                          "options": {
                            "args": [
                              "-p",
                              "3000:3000",
                            ],
                          },
                        },
                      },
                      "technologies": [
                        "docker",
                      ],
                    },
                    "options": {
                      "cwd": "proj",
                    },
                  },
                  "nx-release-publish": {
                    "executor": "@nx/docker:release-publish",
                  },
                },
              },
            },
          },
        ],
      ]
    `);
  });

  it('should use default namedInputs when production is not available', async () => {
    await tempFs.createFiles({
      'proj/Dockerfile': 'FROM node:18',
      'proj/project.json': '{}',
    });

    const results = await createNodesFunction(
      ['proj/Dockerfile'],
      {},
      {
        ...context,
        nxJsonConfiguration: {
          namedInputs: {
            default: ['{projectRoot}/**/*'],
          },
        },
      }
    );

    expect(results).toMatchInlineSnapshot(`
      [
        [
          "proj/Dockerfile",
          {
            "projects": {
              "proj": {
                "metadata": {
                  "targetGroups": {
                    "Docker": [
                      "docker:build",
                      "docker:run",
                      "nx-release-publish",
                    ],
                  },
                },
                "root": "proj",
                "targets": {
                  "docker:build": {
                    "command": "docker build .",
                    "inputs": [
                      "default",
                      "^default",
                    ],
                    "metadata": {
                      "description": "Run Docker build",
                      "help": {
                        "command": "docker build --help",
                        "example": {
                          "options": {
                            "cache-from": "type=s3,region=eu-west-1,bucket=mybucket .",
                            "cache-to": "type=s3,region=eu-west-1,bucket=mybucket .",
                          },
                        },
                      },
                      "technologies": [
                        "docker",
                      ],
                    },
                    "options": {
                      "args": [
                        "--tag proj",
                      ],
                      "cwd": "proj",
                    },
                  },
                  "docker:run": {
                    "command": "docker run {args} proj",
                    "dependsOn": [
                      "docker:build",
                    ],
                    "inputs": [
                      "default",
                      "^default",
                    ],
                    "metadata": {
                      "description": "Run Docker run",
                      "help": {
                        "command": "docker run --help",
                        "example": {
                          "options": {
                            "args": [
                              "-p",
                              "3000:3000",
                            ],
                          },
                        },
                      },
                      "technologies": [
                        "docker",
                      ],
                    },
                    "options": {
                      "cwd": "proj",
                    },
                  },
                  "nx-release-publish": {
                    "executor": "@nx/docker:release-publish",
                  },
                },
              },
            },
          },
        ],
      ]
    `);
  });

  it('should create nodes with custom target names', async () => {
    await tempFs.createFiles({
      'proj/Dockerfile': 'FROM node:18',
      'proj/project.json': '{}',
    });

    const results = await createNodesFunction(
      ['proj/Dockerfile'],
      {
        buildTarget: 'build-docker',
        runTarget: 'run-docker',
      },
      context
    );

    expect(results).toMatchInlineSnapshot(`
      [
        [
          "proj/Dockerfile",
          {
            "projects": {
              "proj": {
                "metadata": {
                  "targetGroups": {
                    "Docker": [
                      "build-docker",
                      "run-docker",
                      "nx-release-publish",
                    ],
                  },
                },
                "root": "proj",
                "targets": {
                  "build-docker": {
                    "command": "docker build .",
                    "inputs": [
                      "production",
                      "^production",
                    ],
                    "metadata": {
                      "description": "Run Docker build",
                      "help": {
                        "command": "docker build --help",
                        "example": {
                          "options": {
                            "cache-from": "type=s3,region=eu-west-1,bucket=mybucket .",
                            "cache-to": "type=s3,region=eu-west-1,bucket=mybucket .",
                          },
                        },
                      },
                      "technologies": [
                        "docker",
                      ],
                    },
                    "options": {
                      "args": [
                        "--tag proj",
                      ],
                      "cwd": "proj",
                    },
                  },
                  "nx-release-publish": {
                    "executor": "@nx/docker:release-publish",
                  },
                  "run-docker": {
                    "command": "docker run {args} proj",
                    "dependsOn": [
                      "build-docker",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                    ],
                    "metadata": {
                      "description": "Run Docker run",
                      "help": {
                        "command": "docker run --help",
                        "example": {
                          "options": {
                            "args": [
                              "-p",
                              "3000:3000",
                            ],
                          },
                        },
                      },
                      "technologies": [
                        "docker",
                      ],
                    },
                    "options": {
                      "cwd": "proj",
                    },
                  },
                },
              },
            },
          },
        ],
      ]
    `);
  });

  it('should handle nested project structures', async () => {
    await tempFs.createFiles({
      'apps/api/Dockerfile': 'FROM node:18',
      'apps/api/project.json': '{}',
    });

    const results = await createNodesFunction(
      ['apps/api/Dockerfile'],
      {},
      context
    );

    expect(results).toMatchInlineSnapshot(`
      [
        [
          "apps/api/Dockerfile",
          {
            "projects": {
              "apps/api": {
                "metadata": {
                  "targetGroups": {
                    "Docker": [
                      "docker:build",
                      "docker:run",
                      "nx-release-publish",
                    ],
                  },
                },
                "root": "apps/api",
                "targets": {
                  "docker:build": {
                    "command": "docker build .",
                    "inputs": [
                      "production",
                      "^production",
                    ],
                    "metadata": {
                      "description": "Run Docker build",
                      "help": {
                        "command": "docker build --help",
                        "example": {
                          "options": {
                            "cache-from": "type=s3,region=eu-west-1,bucket=mybucket .",
                            "cache-to": "type=s3,region=eu-west-1,bucket=mybucket .",
                          },
                        },
                      },
                      "technologies": [
                        "docker",
                      ],
                    },
                    "options": {
                      "args": [
                        "--tag apps-api",
                      ],
                      "cwd": "apps/api",
                    },
                  },
                  "docker:run": {
                    "command": "docker run {args} apps-api",
                    "dependsOn": [
                      "docker:build",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                    ],
                    "metadata": {
                      "description": "Run Docker run",
                      "help": {
                        "command": "docker run --help",
                        "example": {
                          "options": {
                            "args": [
                              "-p",
                              "3000:3000",
                            ],
                          },
                        },
                      },
                      "technologies": [
                        "docker",
                      ],
                    },
                    "options": {
                      "cwd": "apps/api",
                    },
                  },
                  "nx-release-publish": {
                    "executor": "@nx/docker:release-publish",
                  },
                },
              },
            },
          },
        ],
      ]
    `);
  });

  it('should handle project names with special characters', async () => {
    await tempFs.createFiles({
      'apps/my-app/Dockerfile': 'FROM node:18',
      'apps/my-app/project.json': '{}',
    });

    const results = await createNodesFunction(
      ['apps/my-app/Dockerfile'],
      {},
      context
    );

    const targets = results[0][1].projects['apps/my-app'].targets;
    expect(targets['docker:build'].options.args[0]).toBe('--tag apps-my-app');
    expect(targets['docker:run'].command).toBe('docker run {args} apps-my-app');
  });

  it('should handle multiple Dockerfiles', async () => {
    await tempFs.createFiles({
      'app1/Dockerfile': 'FROM node:18',
      'app1/project.json': '{}',
      'app2/Dockerfile': 'FROM node:18',
      'app2/project.json': '{}',
    });

    const results = await createNodesFunction(
      ['app1/Dockerfile', 'app2/Dockerfile'],
      {},
      context
    );

    expect(results).toHaveLength(2);
    expect(results[0][0]).toBe('app1/Dockerfile');
    expect(results[1][0]).toBe('app2/Dockerfile');
    expect(Object.keys(results[0][1].projects)).toEqual(['app1']);
    expect(Object.keys(results[1][1].projects)).toEqual(['app2']);
  });

  it('should use cached targets when hash matches', async () => {
    await tempFs.createFiles({
      'proj/Dockerfile': 'FROM node:18',
      'proj/project.json': '{}',
    });

    // First call
    const results1 = await createNodesFunction(
      ['proj/Dockerfile'],
      {},
      context
    );

    // Second call with same options and context
    const results2 = await createNodesFunction(
      ['proj/Dockerfile'],
      {},
      context
    );

    expect(results1).toEqual(results2);
  });

  it('should handle root level Dockerfile', async () => {
    await tempFs.createFiles({
      Dockerfile: 'FROM node:18',
      'project.json': '{}',
    });

    const results = await createNodesFunction(['Dockerfile'], {}, context);

    expect(results).toMatchInlineSnapshot(`
      [
        [
          "Dockerfile",
          {
            "projects": {
              ".": {
                "metadata": {
                  "targetGroups": {
                    "Docker": [
                      "docker:build",
                      "docker:run",
                      "nx-release-publish",
                    ],
                  },
                },
                "root": ".",
                "targets": {
                  "docker:build": {
                    "command": "docker build .",
                    "inputs": [
                      "production",
                      "^production",
                    ],
                    "metadata": {
                      "description": "Run Docker build",
                      "help": {
                        "command": "docker build --help",
                        "example": {
                          "options": {
                            "cache-from": "type=s3,region=eu-west-1,bucket=mybucket .",
                            "cache-to": "type=s3,region=eu-west-1,bucket=mybucket .",
                          },
                        },
                      },
                      "technologies": [
                        "docker",
                      ],
                    },
                    "options": {
                      "args": [
                        "--tag .",
                      ],
                      "cwd": ".",
                    },
                  },
                  "docker:run": {
                    "command": "docker run {args} .",
                    "dependsOn": [
                      "docker:build",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                    ],
                    "metadata": {
                      "description": "Run Docker run",
                      "help": {
                        "command": "docker run --help",
                        "example": {
                          "options": {
                            "args": [
                              "-p",
                              "3000:3000",
                            ],
                          },
                        },
                      },
                      "technologies": [
                        "docker",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                    },
                  },
                  "nx-release-publish": {
                    "executor": "@nx/docker:release-publish",
                  },
                },
              },
            },
          },
        ],
      ]
    `);
  });

  describe('image reference generation', () => {
    it('should handle leading slashes in project root', async () => {
      await tempFs.createFiles({
        'proj/Dockerfile': 'FROM node:18',
        'proj/project.json': '{}',
      });

      const results = await createNodesFunction(
        ['proj/Dockerfile'],
        {},
        context
      );

      const targets = results[0][1].projects['proj'].targets;
      expect(targets['docker:build'].options.args[0]).toBe('--tag proj');
    });

    it('should handle spaces in project path', async () => {
      await tempFs.createFiles({
        'my proj/Dockerfile': 'FROM node:18',
        'my proj/project.json': '{}',
      });

      const results = await createNodesFunction(
        ['my proj/Dockerfile'],
        {},
        context
      );

      const targets = results[0][1].projects['my proj'].targets;
      expect(targets['docker:build'].options.args[0]).toBe('--tag my-proj');
      expect(targets['docker:run'].command).toBe('docker run {args} my-proj');
    });
  });

  describe('normalizePluginOptions', () => {
    it('should use default values when options are not provided', async () => {
      await tempFs.createFiles({
        'proj/Dockerfile': 'FROM node:18',
        'proj/project.json': '{}',
      });

      const results = await createNodesFunction(
        ['proj/Dockerfile'],
        {},
        context
      );

      const targets = results[0][1].projects['proj'].targets;
      expect(Object.keys(targets)).toContain('docker:build');
      expect(Object.keys(targets)).toContain('docker:run');
    });

    it('should use default values for missing options', async () => {
      await tempFs.createFiles({
        'proj/Dockerfile': 'FROM node:18',
        'proj/project.json': '{}',
      });

      const results = await createNodesFunction(
        ['proj/Dockerfile'],
        { buildTarget: 'custom-build' },
        context
      );

      const targets = results[0][1].projects['proj'].targets;
      expect(Object.keys(targets)).toContain('custom-build');
      expect(Object.keys(targets)).toContain('docker:run'); // default value
    });
  });

  describe('dependency handling', () => {
    it('should set run target to depend on build target', async () => {
      await tempFs.createFiles({
        'proj/Dockerfile': 'FROM node:18',
        'proj/project.json': '{}',
      });

      const results = await createNodesFunction(
        ['proj/Dockerfile'],
        {
          buildTarget: 'build',
          runTarget: 'run',
        },
        context
      );

      const targets = results[0][1].projects['proj'].targets;
      expect(targets['run'].dependsOn).toEqual(['build']);
    });
  });
});
