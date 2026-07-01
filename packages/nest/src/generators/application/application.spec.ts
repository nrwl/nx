import {
  getProjects,
  readJson,
  readProjectConfiguration,
  updateJson,
  writeJson,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { applicationGenerator } from './application';

describe('application generator', () => {
  let tree: Tree;
  const appDirectory = 'my-node-app';

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest.clearAllMocks();
  });

  it('should generate project configurations', async () => {
    await applicationGenerator(tree, {
      directory: appDirectory,
      addPlugin: true,
    });

    const projectConfigurations = getProjects(tree);
    const project = projectConfigurations.get(appDirectory);

    expect(projectConfigurations.get(`${appDirectory}-e2e`)).toBeTruthy();
    expect(project).toMatchInlineSnapshot(`
      {
        "$schema": "../node_modules/nx/schemas/project-schema.json",
        "name": "my-node-app",
        "projectType": "application",
        "root": "my-node-app",
        "sourceRoot": "my-node-app/src",
        "tags": [],
        "targets": {
          "build": {
            "configurations": {
              "development": {
                "env": {
                  "NODE_ENV": "development",
                },
              },
            },
            "executor": "nx:run-commands",
            "options": {
              "command": "webpack-cli build",
              "cwd": "my-node-app",
              "env": {
                "NODE_ENV": "production",
              },
            },
          },
          "copy-workspace-modules": {
            "cache": true,
            "dependsOn": [
              "build",
            ],
            "executor": "@nx/js:copy-workspace-modules",
            "options": {
              "buildTarget": "build",
            },
            "outputs": [
              "{workspaceRoot}/dist/my-node-app/workspace_modules",
            ],
          },
          "prune": {
            "dependsOn": [
              "prune-lockfile",
              "copy-workspace-modules",
            ],
            "executor": "nx:noop",
          },
          "prune-lockfile": {
            "cache": true,
            "dependsOn": [
              "build",
            ],
            "executor": "@nx/js:prune-lockfile",
            "options": {
              "buildTarget": "build",
            },
            "outputs": [
              "{workspaceRoot}/dist/my-node-app/package.json",
              "{workspaceRoot}/dist/my-node-app/pnpm-lock.yaml",
            ],
          },
          "serve": {
            "configurations": {
              "development": {
                "buildTarget": "my-node-app:build:development",
              },
              "production": {
                "buildTarget": "my-node-app:build:production",
              },
            },
            "continuous": true,
            "defaultConfiguration": "development",
            "dependsOn": [
              "build",
            ],
            "executor": "@nx/js:node",
            "options": {
              "buildTarget": "my-node-app:build",
              "runBuildTargetDependencies": false,
            },
          },
          "test": {
            "options": {
              "passWithNoTests": true,
            },
          },
        },
      }
    `);
  });

  it('should generate files', async () => {
    await applicationGenerator(tree, {
      directory: appDirectory,
      addPlugin: true,
    });

    expect(tree.exists(`${appDirectory}/src/main.ts`)).toBeTruthy();

    expect(
      tree.exists(`${appDirectory}/src/app/app.controller.ts`)
    ).toBeTruthy();
    expect(tree.exists(`${appDirectory}/src/app/app.module.ts`)).toBeTruthy();
    expect(tree.exists(`${appDirectory}/src/app/app.service.ts`)).toBeTruthy();
  });

  it('should generate spec files when unitTestRunner is jest', async () => {
    await applicationGenerator(tree, {
      directory: appDirectory,
      unitTestRunner: 'jest',
      addPlugin: true,
    });

    expect(
      tree.exists(`${appDirectory}/src/app/app.controller.spec.ts`)
    ).toBeTruthy();
    expect(
      tree.exists(`${appDirectory}/src/app/app.service.spec.ts`)
    ).toBeTruthy();
  });

  it('should configure tsconfig correctly', async () => {
    // pin TS<6 to exercise the 'node10' branch deterministically
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies ??= {};
      json.devDependencies.typescript = '~5.9.2';
      return json;
    });

    await applicationGenerator(tree, {
      directory: appDirectory,
      addPlugin: true,
    });

    const tsConfig = readJson(tree, `${appDirectory}/tsconfig.app.json`);
    expect(tsConfig.compilerOptions.emitDecoratorMetadata).toBe(true);
    expect(tsConfig.compilerOptions.target).toBe('es2021');
    // commonjs context: 'node10' is valid on TS<6, deprecated on TS>=6
    expect(tsConfig.compilerOptions.moduleResolution).toBe('node10');
    expect(tsConfig.exclude).toEqual([
      'jest.config.ts',
      'jest.config.cts',
      'src/**/*.spec.ts',
      'src/**/*.test.ts',
    ]);
  });

  it('should set moduleResolution to "bundler" when typescript is >=6', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies ??= {};
      json.devDependencies.typescript = '~6.0.3';
      return json;
    });

    await applicationGenerator(tree, {
      directory: appDirectory,
      addPlugin: true,
    });

    const tsConfig = readJson(tree, `${appDirectory}/tsconfig.app.json`);
    expect(tsConfig.compilerOptions.moduleResolution).toBe('bundler');
  });

  it('should add strict checks with --strict', async () => {
    await applicationGenerator(tree, {
      directory: appDirectory,
      strict: true,
      addPlugin: true,
    });
    const tsConfig = readJson(tree, `${appDirectory}/tsconfig.app.json`);

    expect(tsConfig.compilerOptions.strictNullChecks).toBeTruthy();
    expect(tsConfig.compilerOptions.noImplicitAny).toBeTruthy();
    expect(tsConfig.compilerOptions.strictBindCallApply).toBeTruthy();
    expect(
      tsConfig.compilerOptions.forceConsistentCasingInFileNames
    ).toBeTruthy();
    expect(tsConfig.compilerOptions.noFallthroughCasesInSwitch).toBeTruthy();
  });

  describe('--skipFormat', () => {
    let formatFilesSpy: jest.SpyInstance;

    beforeEach(() => {
      const devkitModule = require('@nx/devkit');
      formatFilesSpy = jest
        .spyOn(devkitModule, 'formatFiles')
        .mockImplementation(() => Promise.resolve());
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it('should format files', async () => {
      await applicationGenerator(tree, {
        directory: appDirectory,
        addPlugin: true,
      });

      expect(formatFilesSpy).toHaveBeenCalled();
    });

    it('should not format files when --skipFormat=true', async () => {
      await applicationGenerator(tree, {
        directory: appDirectory,
        skipFormat: true,
        addPlugin: true,
      });

      expect(formatFilesSpy).not.toHaveBeenCalled();
    });
  });

  describe('--e2e-test-runner none', () => {
    it('should not generate e2e test project', async () => {
      await applicationGenerator(tree, {
        directory: appDirectory,
        e2eTestRunner: 'none',
        addPlugin: true,
      });

      const projectConfigurations = getProjects(tree);

      expect(projectConfigurations.get(`${appDirectory}-e2e`)).toBeUndefined();
    });
  });

  describe('TS solution setup', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => {
        json.workspaces = ['packages/*', 'apps/*'];
        return json;
      });
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          composite: true,
          declaration: true,
        },
      });
      writeJson(tree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        files: [],
        references: [],
      });
    });

    it('should add project references when using TS solution', async () => {
      await applicationGenerator(tree, {
        directory: 'myapp',
        unitTestRunner: 'jest',
        addPlugin: true,
        useProjectJson: false,
      });

      expect(readJson(tree, 'tsconfig.json').references).toMatchInlineSnapshot(
        `[]`
      );
      expect(readJson(tree, 'myapp/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "@nestjs/common": "^11.0.0",
            "@nestjs/core": "^11.0.0",
            "@nestjs/platform-express": "^11.0.0",
            "reflect-metadata": "^0.2.0",
            "rxjs": "^7.8.0",
            "tslib": "^2.3.0",
          },
          "devDependencies": {
            "@nestjs/testing": "^11.0.0",
          },
          "name": "@proj/myapp",
          "nx": {
            "name": "myapp",
            "targets": {
              "build": {
                "configurations": {
                  "development": {
                    "env": {
                      "NODE_ENV": "development",
                    },
                  },
                },
                "executor": "nx:run-commands",
                "options": {
                  "command": "webpack-cli build",
                  "cwd": "myapp",
                  "env": {
                    "NODE_ENV": "production",
                  },
                },
              },
              "copy-workspace-modules": {
                "cache": true,
                "dependsOn": [
                  "build",
                ],
                "executor": "@nx/js:copy-workspace-modules",
                "options": {
                  "buildTarget": "build",
                },
                "outputs": [
                  "{workspaceRoot}/dist/myapp/workspace_modules",
                ],
              },
              "prune": {
                "dependsOn": [
                  "prune-lockfile",
                  "copy-workspace-modules",
                ],
                "executor": "nx:noop",
              },
              "prune-lockfile": {
                "cache": true,
                "dependsOn": [
                  "build",
                ],
                "executor": "@nx/js:prune-lockfile",
                "options": {
                  "buildTarget": "build",
                },
                "outputs": [
                  "{workspaceRoot}/dist/myapp/package.json",
                  "{workspaceRoot}/dist/myapp/pnpm-lock.yaml",
                ],
              },
              "serve": {
                "configurations": {
                  "development": {
                    "buildTarget": "myapp:build:development",
                  },
                  "production": {
                    "buildTarget": "myapp:build:production",
                  },
                },
                "continuous": true,
                "defaultConfiguration": "development",
                "dependsOn": [
                  "build",
                ],
                "executor": "@nx/js:node",
                "options": {
                  "buildTarget": "myapp:build",
                  "runBuildTargetDependencies": false,
                },
              },
              "test": {
                "options": {
                  "passWithNoTests": true,
                },
              },
            },
          },
          "private": true,
          "version": "0.0.1",
        }
      `);
      expect(readJson(tree, 'myapp/tsconfig.json')).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "esModuleInterop": true,
          },
          "extends": "../tsconfig.base.json",
          "files": [],
          "include": [],
          "references": [
            {
              "path": "./tsconfig.app.json",
            },
            {
              "path": "./tsconfig.spec.json",
            },
          ],
        }
      `);
      expect(readJson(tree, 'myapp/tsconfig.app.json')).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "emitDecoratorMetadata": true,
            "experimentalDecorators": true,
            "module": "commonjs",
            "moduleResolution": "bundler",
            "outDir": "../dist/out-tsc",
            "target": "es2021",
            "types": [
              "node",
            ],
          },
          "exclude": [
            "jest.config.ts",
            "jest.config.cts",
            "src/**/*.spec.ts",
            "src/**/*.test.ts",
          ],
          "extends": "./tsconfig.json",
          "include": [
            "src/**/*.ts",
          ],
        }
      `);
      expect(readJson(tree, 'myapp/tsconfig.spec.json')).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "module": "commonjs",
            "moduleResolution": "bundler",
            "outDir": "../dist/out-tsc",
            "types": [
              "jest",
              "node",
            ],
          },
          "extends": "./tsconfig.json",
          "include": [
            "jest.config.ts",
            "jest.config.cts",
            "src/**/*.test.ts",
            "src/**/*.spec.ts",
            "src/**/*.d.ts",
          ],
        }
      `);
    });

    it('should respect the provided name', async () => {
      await applicationGenerator(tree, {
        directory: 'myapp',
        name: 'myapp',
        unitTestRunner: 'jest',
        addPlugin: true,
        useProjectJson: false,
        skipFormat: true,
      });

      const packageJson = readJson(tree, 'myapp/package.json');
      expect(packageJson.name).toBe('@proj/myapp');
      expect(packageJson.nx.name).toBe('myapp');
      // Make sure keys are in idiomatic order
      expect(Object.keys(packageJson)).toMatchInlineSnapshot(`
        [
          "name",
          "version",
          "private",
          "nx",
          "dependencies",
          "devDependencies",
        ]
      `);
    });

    it('should generate project.json if useProjectJson is true', async () => {
      await applicationGenerator(tree, {
        directory: 'myapp',
        e2eTestRunner: 'jest',
        useProjectJson: true,
        addPlugin: true,
        skipFormat: true,
      });

      expect(tree.exists('myapp/project.json')).toBeTruthy();
      expect(readProjectConfiguration(tree, 'myapp')).toMatchInlineSnapshot(`
        {
          "$schema": "../node_modules/nx/schemas/project-schema.json",
          "name": "myapp",
          "projectType": "application",
          "root": "myapp",
          "sourceRoot": "myapp/src",
          "tags": [],
          "targets": {
            "build": {
              "configurations": {
                "development": {
                  "env": {
                    "NODE_ENV": "development",
                  },
                },
              },
              "executor": "nx:run-commands",
              "options": {
                "command": "webpack-cli build",
                "cwd": "myapp",
                "env": {
                  "NODE_ENV": "production",
                },
              },
            },
            "copy-workspace-modules": {
              "cache": true,
              "dependsOn": [
                "build",
              ],
              "executor": "@nx/js:copy-workspace-modules",
              "options": {
                "buildTarget": "build",
              },
              "outputs": [
                "{workspaceRoot}/dist/myapp/workspace_modules",
              ],
            },
            "prune": {
              "dependsOn": [
                "prune-lockfile",
                "copy-workspace-modules",
              ],
              "executor": "nx:noop",
            },
            "prune-lockfile": {
              "cache": true,
              "dependsOn": [
                "build",
              ],
              "executor": "@nx/js:prune-lockfile",
              "options": {
                "buildTarget": "build",
              },
              "outputs": [
                "{workspaceRoot}/dist/myapp/package.json",
                "{workspaceRoot}/dist/myapp/pnpm-lock.yaml",
              ],
            },
            "serve": {
              "configurations": {
                "development": {
                  "buildTarget": "myapp:build:development",
                },
                "production": {
                  "buildTarget": "myapp:build:production",
                },
              },
              "continuous": true,
              "defaultConfiguration": "development",
              "dependsOn": [
                "build",
              ],
              "executor": "@nx/js:node",
              "options": {
                "buildTarget": "myapp:build",
                "runBuildTargetDependencies": false,
              },
            },
            "test": {
              "options": {
                "passWithNoTests": true,
              },
            },
          },
        }
      `);
      expect(tree.exists('myapp-e2e/project.json')).toBeTruthy();
      expect(readProjectConfiguration(tree, 'myapp-e2e'))
        .toMatchInlineSnapshot(`
        {
          "$schema": "../node_modules/nx/schemas/project-schema.json",
          "implicitDependencies": [
            "myapp",
          ],
          "name": "myapp-e2e",
          "projectType": "application",
          "root": "myapp-e2e",
          "targets": {
            "e2e": {
              "dependsOn": [
                "myapp:build",
                "myapp:serve",
              ],
              "executor": "@nx/jest:jest",
              "options": {
                "jestConfig": "myapp-e2e/jest.config.cts",
                "passWithNoTests": true,
              },
              "outputs": [
                "{workspaceRoot}/coverage/{e2eProjectRoot}",
              ],
            },
          },
        }
      `);
      expect(tree.exists('myapp/package.json')).toBeFalsy();
      expect(tree.exists('myapp-e2e/package.json')).toBeFalsy();
    });
  });
});
