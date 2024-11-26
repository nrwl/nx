import type { CreateNodesContextV2 } from '@nx/devkit';
import { mkdirSync, rmdirSync } from 'node:fs';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { createNodesV2, type AngularProjectConfiguration } from './plugin';

jest.mock('nx/src/utils/cache-directory', () => ({
  ...jest.requireActual('nx/src/utils/cache-directory'),
  workspaceDataDirectory: 'tmp/project-graph-cache',
}));

describe('@nx/angular/plugin', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContextV2;
  let tempFs: TempFs;

  beforeEach(async () => {
    mkdirSync('tmp/project-graph-cache', { recursive: true });
    tempFs = new TempFs('angular-plugin');
    context = {
      nxJsonConfiguration: {
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
    rmdirSync('tmp/project-graph-cache', { recursive: true });
  });

  it('should infer tasks from multiple projects in angular.json', async () => {
    await createAngularWorkspace('');
    await addAngularProjectToWorkspace('my-app', '', {
      root: '',
      sourceRoot: 'src',
      projectType: 'application',
      architect: {
        build: {
          builder: '@angular-devkit/build-angular:browser',
          options: { outputPath: 'dist/my-app' },
        },
        test: {
          builder: '@angular-devkit/build-angular:karma',
        },
        serve: {
          builder: '@angular-devkit/build-angular:dev-server',
          options: { browserTarget: 'my-app:build' },
          configurations: {
            production: {
              browserTarget: 'my-app:build:production',
            },
          },
        },
      },
    });
    await addAngularProjectToWorkspace(
      'my-lib',
      '',
      {
        root: 'projects/my-lib',
        sourceRoot: 'projects/my-lib/src',
        projectType: 'library',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:ng-packagr',
            options: { project: 'projects/my-lib/ng-package.json' },
          },
          test: {
            builder: '@angular-devkit/build-angular:karma',
          },
        },
      },
      {
        'projects/my-lib/ng-package.json': JSON.stringify({
          dest: '../../dist/my-lib',
        }),
      }
    );

    const nodes = await createNodesFunction(['angular.json'], {}, context);

    expect(nodes).toMatchInlineSnapshot(`
      [
        [
          "angular.json",
          {
            "projects": {
              ".": {
                "projectType": "application",
                "sourceRoot": "src",
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "ng build",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "@angular/cli",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run the "build" target for "my-app".",
                      "help": {
                        "command": "npx ng run my-app:build --help",
                        "example": {
                          "options": {
                            "localize": true,
                          },
                        },
                      },
                      "technologies": [
                        "angular",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                    },
                    "outputs": [
                      "{projectRoot}/dist/my-app",
                    ],
                  },
                  "serve": {
                    "command": "ng serve",
                    "configurations": {
                      "production": {
                        "command": "ng run my-app:serve:production",
                      },
                    },
                    "metadata": {
                      "description": "Run the "serve" target for "my-app".",
                      "help": {
                        "command": "npx ng run my-app:serve --help",
                        "example": {
                          "options": {
                            "port": 4201,
                          },
                        },
                      },
                      "technologies": [
                        "angular",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                    },
                  },
                  "test": {
                    "cache": true,
                    "command": "ng test",
                    "inputs": [
                      "default",
                      "^production",
                      {
                        "externalDependencies": [
                          "@angular/cli",
                          "karma",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run the "test" target for "my-app".",
                      "help": {
                        "command": "npx ng run my-app:test --help",
                        "example": {
                          "options": {
                            "codeCoverage": true,
                          },
                        },
                      },
                      "technologies": [
                        "angular",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                    },
                    "outputs": [
                      "{workspaceRoot}/coverage/{projectName}",
                    ],
                  },
                },
              },
              "projects/my-lib": {
                "projectType": "library",
                "sourceRoot": "projects/my-lib/src",
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "ng build",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "@angular/cli",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run the "build" target for "my-lib".",
                      "help": {
                        "command": "npx ng run my-lib:build --help",
                        "example": {
                          "options": {
                            "watch": true,
                          },
                        },
                      },
                      "technologies": [
                        "angular",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                    },
                    "outputs": [
                      "{workspaceRoot}/dist/my-lib",
                    ],
                  },
                  "test": {
                    "cache": true,
                    "command": "ng test",
                    "inputs": [
                      "default",
                      "^production",
                      {
                        "externalDependencies": [
                          "@angular/cli",
                          "karma",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run the "test" target for "my-lib".",
                      "help": {
                        "command": "npx ng run my-lib:test --help",
                        "example": {
                          "options": {
                            "codeCoverage": true,
                          },
                        },
                      },
                      "technologies": [
                        "angular",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                    },
                    "outputs": [
                      "{workspaceRoot}/coverage/{projectName}",
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

  it('should infer tasks from multiple angular.json files', async () => {
    const org1Root = 'nested-ng-workspaces/org1';
    await createAngularWorkspace(org1Root);
    await addAngularProjectToWorkspace('org1-app1', org1Root, {
      root: '',
      sourceRoot: 'src',
      projectType: 'application',
      architect: {
        build: {
          builder: '@angular-devkit/build-angular:browser',
          options: { outputPath: 'dist/my-app' },
        },
        test: {
          builder: '@angular-devkit/build-angular:karma',
        },
        serve: {
          builder: '@angular-devkit/build-angular:dev-server',
          options: { browserTarget: 'my-app:build' },
          configurations: {
            production: {
              browserTarget: 'my-app:build:production',
            },
          },
        },
      },
    });
    await addAngularProjectToWorkspace(
      'org1-lib1',
      org1Root,
      {
        root: 'projects/org1-lib1',
        sourceRoot: 'projects/org1-lib1/src',
        projectType: 'library',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:ng-packagr',
            options: { project: 'projects/org1-lib1/ng-package.json' },
          },
          test: {
            builder: '@angular-devkit/build-angular:karma',
          },
        },
      },
      {
        [`${org1Root}/projects/org1-lib1/ng-package.json`]: JSON.stringify({
          dest: '../../dist/my-lib',
        }),
      }
    );

    const org2Root = 'nested-ng-workspaces/org2';
    await createAngularWorkspace(org2Root);
    await addAngularProjectToWorkspace('org2-app1', org2Root, {
      root: '',
      sourceRoot: 'src',
      projectType: 'application',
      architect: {
        build: {
          builder: '@angular-devkit/build-angular:browser',
          options: { outputPath: 'dist/my-app' },
        },
        test: {
          builder: '@angular-devkit/build-angular:karma',
        },
        serve: {
          builder: '@angular-devkit/build-angular:dev-server',
          options: { browserTarget: 'my-app:build' },
          configurations: {
            production: {
              browserTarget: 'my-app:build:production',
            },
          },
        },
      },
    });
    await addAngularProjectToWorkspace(
      'org2-lib1',
      org2Root,
      {
        root: 'projects/org2-lib1',
        sourceRoot: 'projects/org2-lib1/src',
        projectType: 'library',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:ng-packagr',
            options: { project: 'projects/org2-lib1/ng-package.json' },
          },
          test: {
            builder: '@angular-devkit/build-angular:karma',
          },
        },
      },
      {
        [`${org2Root}/projects/org2-lib1/ng-package.json`]: JSON.stringify({
          dest: '../../dist/my-lib',
        }),
      }
    );

    const nodes = await createNodesFunction(
      [
        'nested-ng-workspaces/org1/angular.json',
        'nested-ng-workspaces/org2/angular.json',
      ],
      {},
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      [
        [
          "nested-ng-workspaces/org1/angular.json",
          {
            "projects": {
              "nested-ng-workspaces/org1": {
                "projectType": "application",
                "sourceRoot": "nested-ng-workspaces/org1/src",
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "ng build",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "@angular/cli",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run the "build" target for "org1-app1".",
                      "help": {
                        "command": "npx ng run org1-app1:build --help",
                        "example": {
                          "options": {
                            "localize": true,
                          },
                        },
                      },
                      "technologies": [
                        "angular",
                      ],
                    },
                    "options": {
                      "cwd": "nested-ng-workspaces/org1",
                    },
                    "outputs": [
                      "{projectRoot}/dist/my-app",
                    ],
                  },
                  "serve": {
                    "command": "ng serve",
                    "configurations": {
                      "production": {
                        "command": "ng run org1-app1:serve:production",
                      },
                    },
                    "metadata": {
                      "description": "Run the "serve" target for "org1-app1".",
                      "help": {
                        "command": "npx ng run org1-app1:serve --help",
                        "example": {
                          "options": {
                            "port": 4201,
                          },
                        },
                      },
                      "technologies": [
                        "angular",
                      ],
                    },
                    "options": {
                      "cwd": "nested-ng-workspaces/org1",
                    },
                  },
                  "test": {
                    "cache": true,
                    "command": "ng test",
                    "inputs": [
                      "default",
                      "^production",
                      {
                        "externalDependencies": [
                          "@angular/cli",
                          "karma",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run the "test" target for "org1-app1".",
                      "help": {
                        "command": "npx ng run org1-app1:test --help",
                        "example": {
                          "options": {
                            "codeCoverage": true,
                          },
                        },
                      },
                      "technologies": [
                        "angular",
                      ],
                    },
                    "options": {
                      "cwd": "nested-ng-workspaces/org1",
                    },
                    "outputs": [
                      "{workspaceRoot}/nested-ng-workspaces/org1/coverage/{projectName}",
                    ],
                  },
                },
              },
              "nested-ng-workspaces/org1/projects/org1-lib1": {
                "projectType": "library",
                "sourceRoot": "nested-ng-workspaces/org1/projects/org1-lib1/src",
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "ng build",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "@angular/cli",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run the "build" target for "org1-lib1".",
                      "help": {
                        "command": "npx ng run org1-lib1:build --help",
                        "example": {
                          "options": {
                            "watch": true,
                          },
                        },
                      },
                      "technologies": [
                        "angular",
                      ],
                    },
                    "options": {
                      "cwd": "nested-ng-workspaces/org1",
                    },
                    "outputs": [
                      "{workspaceRoot}/nested-ng-workspaces/org1/dist/my-lib",
                    ],
                  },
                  "test": {
                    "cache": true,
                    "command": "ng test",
                    "inputs": [
                      "default",
                      "^production",
                      {
                        "externalDependencies": [
                          "@angular/cli",
                          "karma",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run the "test" target for "org1-lib1".",
                      "help": {
                        "command": "npx ng run org1-lib1:test --help",
                        "example": {
                          "options": {
                            "codeCoverage": true,
                          },
                        },
                      },
                      "technologies": [
                        "angular",
                      ],
                    },
                    "options": {
                      "cwd": "nested-ng-workspaces/org1",
                    },
                    "outputs": [
                      "{workspaceRoot}/nested-ng-workspaces/org1/coverage/{projectName}",
                    ],
                  },
                },
              },
            },
          },
        ],
        [
          "nested-ng-workspaces/org2/angular.json",
          {
            "projects": {
              "nested-ng-workspaces/org2": {
                "projectType": "application",
                "sourceRoot": "nested-ng-workspaces/org2/src",
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "ng build",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "@angular/cli",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run the "build" target for "org2-app1".",
                      "help": {
                        "command": "npx ng run org2-app1:build --help",
                        "example": {
                          "options": {
                            "localize": true,
                          },
                        },
                      },
                      "technologies": [
                        "angular",
                      ],
                    },
                    "options": {
                      "cwd": "nested-ng-workspaces/org2",
                    },
                    "outputs": [
                      "{projectRoot}/dist/my-app",
                    ],
                  },
                  "serve": {
                    "command": "ng serve",
                    "configurations": {
                      "production": {
                        "command": "ng run org2-app1:serve:production",
                      },
                    },
                    "metadata": {
                      "description": "Run the "serve" target for "org2-app1".",
                      "help": {
                        "command": "npx ng run org2-app1:serve --help",
                        "example": {
                          "options": {
                            "port": 4201,
                          },
                        },
                      },
                      "technologies": [
                        "angular",
                      ],
                    },
                    "options": {
                      "cwd": "nested-ng-workspaces/org2",
                    },
                  },
                  "test": {
                    "cache": true,
                    "command": "ng test",
                    "inputs": [
                      "default",
                      "^production",
                      {
                        "externalDependencies": [
                          "@angular/cli",
                          "karma",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run the "test" target for "org2-app1".",
                      "help": {
                        "command": "npx ng run org2-app1:test --help",
                        "example": {
                          "options": {
                            "codeCoverage": true,
                          },
                        },
                      },
                      "technologies": [
                        "angular",
                      ],
                    },
                    "options": {
                      "cwd": "nested-ng-workspaces/org2",
                    },
                    "outputs": [
                      "{workspaceRoot}/nested-ng-workspaces/org2/coverage/{projectName}",
                    ],
                  },
                },
              },
              "nested-ng-workspaces/org2/projects/org2-lib1": {
                "projectType": "library",
                "sourceRoot": "nested-ng-workspaces/org2/projects/org2-lib1/src",
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "ng build",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "@angular/cli",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run the "build" target for "org2-lib1".",
                      "help": {
                        "command": "npx ng run org2-lib1:build --help",
                        "example": {
                          "options": {
                            "watch": true,
                          },
                        },
                      },
                      "technologies": [
                        "angular",
                      ],
                    },
                    "options": {
                      "cwd": "nested-ng-workspaces/org2",
                    },
                    "outputs": [
                      "{workspaceRoot}/nested-ng-workspaces/org2/dist/my-lib",
                    ],
                  },
                  "test": {
                    "cache": true,
                    "command": "ng test",
                    "inputs": [
                      "default",
                      "^production",
                      {
                        "externalDependencies": [
                          "@angular/cli",
                          "karma",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run the "test" target for "org2-lib1".",
                      "help": {
                        "command": "npx ng run org2-lib1:test --help",
                        "example": {
                          "options": {
                            "codeCoverage": true,
                          },
                        },
                      },
                      "technologies": [
                        "angular",
                      ],
                    },
                    "options": {
                      "cwd": "nested-ng-workspaces/org2",
                    },
                    "outputs": [
                      "{workspaceRoot}/nested-ng-workspaces/org2/coverage/{projectName}",
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

  it('should infer outputs correctly from ng-package.json `dest` property', async () => {
    await createAngularWorkspace('');
    await addAngularProjectToWorkspace(
      'my-lib',
      '',
      {
        root: 'projects/my-lib',
        sourceRoot: 'projects/my-lib/src',
        projectType: 'library',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:ng-packagr',
            options: { project: 'projects/my-lib/ng-package.json' },
          },
          test: {
            builder: '@angular-devkit/build-angular:karma',
          },
        },
      },
      {
        'projects/my-lib/ng-package.json': JSON.stringify({
          dest: '../../build-output/custom-nested/my-lib',
        }),
      }
    );

    const nodes = await createNodesFunction(['angular.json'], {}, context);

    expect(
      nodes[0][1].projects['projects/my-lib'].targets.build.outputs
    ).toEqual(['{workspaceRoot}/build-output/custom-nested/my-lib']);
  });

  it('should infer outputs correctly from existing ng-package.json `dest` property when `project` is a directory', async () => {
    await createAngularWorkspace('');
    await addAngularProjectToWorkspace(
      'my-lib',
      '',
      {
        root: 'projects/my-lib',
        sourceRoot: 'projects/my-lib/src',
        projectType: 'library',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:ng-packagr',
            options: { project: 'projects/my-lib' },
          },
          test: {
            builder: '@angular-devkit/build-angular:karma',
          },
        },
      },
      {
        'projects/my-lib/ng-package.json': JSON.stringify({
          dest: '../../build-output/custom-nested/my-lib',
        }),
      }
    );

    const nodes = await createNodesFunction(['angular.json'], {}, context);

    expect(
      nodes[0][1].projects['projects/my-lib'].targets.build.outputs
    ).toEqual(['{workspaceRoot}/build-output/custom-nested/my-lib']);
  });

  it('should infer outputs correctly from ng-package.js `dest` property', async () => {
    await createAngularWorkspace('');
    await addAngularProjectToWorkspace(
      'my-lib',
      '',
      {
        root: 'projects/my-lib',
        sourceRoot: 'projects/my-lib/src',
        projectType: 'library',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:ng-packagr',
            options: { project: 'projects/my-lib/ng-package.js' },
          },
          test: {
            builder: '@angular-devkit/build-angular:karma',
          },
        },
      },
      {
        'projects/my-lib/ng-package.js': `
          module.exports = {
            dest: '../../build-output/custom-nested/my-lib',
          };
        `,
      }
    );

    const nodes = await createNodesFunction(['angular.json'], {}, context);

    expect(
      nodes[0][1].projects['projects/my-lib'].targets.build.outputs
    ).toEqual(['{workspaceRoot}/build-output/custom-nested/my-lib']);
  });

  it('should infer outputs correctly from existing ng-package.js `dest` property when `project` is a directory', async () => {
    await createAngularWorkspace('');
    await addAngularProjectToWorkspace(
      'my-lib',
      '',
      {
        root: 'projects/my-lib',
        sourceRoot: 'projects/my-lib/src',
        projectType: 'library',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:ng-packagr',
            options: { project: 'projects/my-lib' },
          },
          test: {
            builder: '@angular-devkit/build-angular:karma',
          },
        },
      },
      {
        'projects/my-lib/ng-package.js': `
          module.exports = {
            dest: '../../build-output/custom-nested/my-lib',
          };
        `,
      }
    );

    const nodes = await createNodesFunction(['angular.json'], {}, context);

    expect(
      nodes[0][1].projects['projects/my-lib'].targets.build.outputs
    ).toEqual(['{workspaceRoot}/build-output/custom-nested/my-lib']);
  });

  it('should infer the `app-shell` task inputs & outputs from the `browserTarget` and `serverTarget` tasks', async () => {
    await createAngularWorkspace('');
    await addAngularProjectToWorkspace('my-app', '', {
      root: '',
      sourceRoot: 'src',
      projectType: 'application',
      architect: {
        build: {
          builder: '@angular-devkit/build-angular:browser',
          options: { outputPath: 'dist/my-app/browser' },
        },
        serve: {
          builder: '@angular-devkit/build-angular:dev-server',
          options: { browserTarget: 'my-app:build' },
          configurations: {
            production: {
              browserTarget: 'my-app:build:production',
            },
          },
        },
        server: {
          builder: '@angular-devkit/build-angular:server',
          options: { outputPath: 'dist/my-app/server' },
        },
        'app-shell': {
          builder: '@angular-devkit/build-angular:app-shell',
          options: { route: 'shell' },
          configurations: {
            production: {
              browserTarget: 'my-app:build:production',
              serverTarget: 'my-app:server:production',
            },
            development: {
              browserTarget: 'my-app:build:development',
              serverTarget: 'my-app:server:development',
            },
          },
          defaultConfiguration: 'production',
        },
      },
    });

    const nodes = await createNodesFunction(['angular.json'], {}, context);

    expect(nodes[0][1].projects['.'].targets['app-shell'])
      .toMatchInlineSnapshot(`
      {
        "cache": true,
        "command": "ng run my-app:app-shell",
        "configurations": {
          "development": {
            "command": "ng run my-app:app-shell:development",
          },
          "production": {
            "command": "ng run my-app:app-shell:production",
          },
        },
        "defaultConfiguration": "production",
        "inputs": [
          "production",
          "^production",
          {
            "externalDependencies": [
              "@angular/cli",
            ],
          },
        ],
        "metadata": {
          "description": "Run the "app-shell" target for "my-app".",
          "help": {
            "command": "npx ng run my-app:app-shell --help",
            "example": {
              "options": {
                "route": "/some/route",
              },
            },
          },
          "technologies": [
            "angular",
          ],
        },
        "options": {
          "cwd": ".",
        },
        "outputs": [
          "{projectRoot}/dist/my-app/browser",
          "{projectRoot}/dist/my-app/server",
        ],
      }
    `);
  });

  it('should include the `outputIndexPath` option if set in the `app-shell` task outputs', async () => {
    await createAngularWorkspace('');
    await addAngularProjectToWorkspace('my-app', '', {
      root: '',
      sourceRoot: 'src',
      projectType: 'application',
      architect: {
        build: {
          builder: '@angular-devkit/build-angular:browser',
          options: { outputPath: 'dist/my-app/browser' },
        },
        serve: {
          builder: '@angular-devkit/build-angular:dev-server',
          options: { browserTarget: 'my-app:build' },
          configurations: {
            production: {
              browserTarget: 'my-app:build:production',
            },
          },
        },
        server: {
          builder: '@angular-devkit/build-angular:server',
          options: { outputPath: 'dist/my-app/server' },
        },
        'app-shell': {
          builder: '@angular-devkit/build-angular:app-shell',
          options: {
            route: 'shell',
            outputIndexPath: 'dist/my-app/index.html',
          },
          configurations: {
            production: {
              browserTarget: 'my-app:build:production',
              serverTarget: 'my-app:server:production',
            },
            development: {
              browserTarget: 'my-app:build:development',
              serverTarget: 'my-app:server:development',
            },
          },
          defaultConfiguration: 'production',
        },
      },
    });

    const nodes = await createNodesFunction(['angular.json'], {}, context);

    expect(
      nodes[0][1].projects['.'].targets['app-shell'].outputs
    ).toStrictEqual([
      '{projectRoot}/dist/my-app/browser',
      '{projectRoot}/dist/my-app/server',
      '{projectRoot}/dist/my-app/index.html',
    ]);
  });

  it('should infer the `prerender` task inputs & outputs from the `browserTarget` and `serverTarget` tasks', async () => {
    await createAngularWorkspace('');
    await addAngularProjectToWorkspace('my-app', '', {
      root: '',
      sourceRoot: 'src',
      projectType: 'application',
      architect: {
        build: {
          builder: '@angular-devkit/build-angular:browser',
          options: { outputPath: 'dist/my-app/browser' },
        },
        serve: {
          builder: '@angular-devkit/build-angular:dev-server',
          options: { browserTarget: 'my-app:build' },
          configurations: {
            production: {
              browserTarget: 'my-app:build:production',
            },
          },
        },
        server: {
          builder: '@angular-devkit/build-angular:server',
          options: { outputPath: 'dist/my-app/server' },
        },
        prerender: {
          builder: '@angular-devkit/build-angular:prerender',
          options: { routes: ['/'] },
          configurations: {
            production: {
              browserTarget: 'my-app:build:production',
              serverTarget: 'my-app:server:production',
            },
            development: {
              browserTarget: 'my-app:build:development',
              serverTarget: 'my-app:server:development',
            },
          },
          defaultConfiguration: 'production',
        },
      },
    });

    const nodes = await createNodesFunction(['angular.json'], {}, context);

    expect(nodes[0][1].projects['.'].targets.prerender).toMatchInlineSnapshot(`
      {
        "cache": true,
        "command": "ng run my-app:prerender",
        "configurations": {
          "development": {
            "command": "ng run my-app:prerender:development",
          },
          "production": {
            "command": "ng run my-app:prerender:production",
          },
        },
        "defaultConfiguration": "production",
        "inputs": [
          "production",
          "^production",
          {
            "externalDependencies": [
              "@angular/cli",
            ],
          },
        ],
        "metadata": {
          "description": "Run the "prerender" target for "my-app".",
          "help": {
            "command": "npx ng run my-app:prerender --help",
            "example": {
              "options": {
                "discoverRoutes": false,
              },
            },
          },
          "technologies": [
            "angular",
          ],
        },
        "options": {
          "cwd": ".",
        },
        "outputs": [
          "{projectRoot}/dist/my-app/browser",
          "{projectRoot}/dist/my-app/server",
        ],
      }
    `);
  });

  it('should infer tasks using unsupported builders', async () => {
    await createAngularWorkspace('');
    await addAngularProjectToWorkspace('my-app', '', {
      root: '',
      sourceRoot: 'src',
      projectType: 'application',
      architect: {
        'some-target': {
          builder: '@foo/bar:baz',
          options: { foo: true },
        },
      },
    });

    const nodes = await createNodesFunction(['angular.json'], {}, context);

    expect(nodes[0][1].projects['.'].targets['some-target'])
      .toMatchInlineSnapshot(`
      {
        "command": "ng run my-app:some-target",
        "metadata": {
          "description": "Run the "some-target" target for "my-app".",
          "help": {
            "command": "npx ng run my-app:some-target --help",
            "example": {},
          },
          "technologies": [
            "angular",
          ],
        },
        "options": {
          "cwd": ".",
        },
      }
    `);
  });

  async function createAngularWorkspace(root: string) {
    await tempFs.createFiles({
      [`${root}/package.json`]: '{}',
      [`${root}/angular.json`]: JSON.stringify({ projects: {} }),
    });
  }

  async function addAngularProjectToWorkspace(
    project: string,
    angularWorkspaceRoot: string,
    projectConfiguration: AngularProjectConfiguration,
    files?: Record<string, string>
  ) {
    const angularJson = JSON.parse(
      await tempFs.readFile(`${angularWorkspaceRoot}/angular.json`)
    );
    angularJson.projects[project] = projectConfiguration;
    tempFs.writeFile(
      `${angularWorkspaceRoot}/angular.json`,
      JSON.stringify(angularJson, null, 2)
    );

    if (files) {
      await tempFs.createFiles(files);
    }
  }
});
