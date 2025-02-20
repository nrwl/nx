import { readJson, updateJson, writeJson, type Tree } from '@nx/devkit';
import * as devkit from '@nx/devkit';
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

    const projectConfigurations = devkit.getProjects(tree);
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
                "args": [
                  "node-env=development",
                ],
              },
            },
            "executor": "nx:run-commands",
            "options": {
              "args": [
                "node-env=production",
              ],
              "command": "webpack-cli build",
            },
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
      tree.exists(`${appDirectory}/src/app/app.controller.spec.ts`)
    ).toBeTruthy();
    expect(
      tree.exists(`${appDirectory}/src/app/app.controller.ts`)
    ).toBeTruthy();
    expect(tree.exists(`${appDirectory}/src/app/app.module.ts`)).toBeTruthy();
    expect(
      tree.exists(`${appDirectory}/src/app/app.service.spec.ts`)
    ).toBeTruthy();
    expect(tree.exists(`${appDirectory}/src/app/app.service.ts`)).toBeTruthy();
  });

  it('should configure tsconfig correctly', async () => {
    await applicationGenerator(tree, {
      directory: appDirectory,
      addPlugin: true,
    });

    const tsConfig = devkit.readJson(tree, `${appDirectory}/tsconfig.app.json`);
    expect(tsConfig.compilerOptions.emitDecoratorMetadata).toBe(true);
    expect(tsConfig.compilerOptions.target).toBe('es2021');
    expect(tsConfig.exclude).toEqual([
      'jest.config.ts',
      'src/**/*.spec.ts',
      'src/**/*.test.ts',
    ]);
  });

  it('should add strict checks with --strict', async () => {
    await applicationGenerator(tree, {
      directory: appDirectory,
      strict: true,
      addPlugin: true,
    });
    const tsConfig = devkit.readJson(tree, `${appDirectory}/tsconfig.app.json`);

    expect(tsConfig.compilerOptions.strictNullChecks).toBeTruthy();
    expect(tsConfig.compilerOptions.noImplicitAny).toBeTruthy();
    expect(tsConfig.compilerOptions.strictBindCallApply).toBeTruthy();
    expect(
      tsConfig.compilerOptions.forceConsistentCasingInFileNames
    ).toBeTruthy();
    expect(tsConfig.compilerOptions.noFallthroughCasesInSwitch).toBeTruthy();
  });

  describe('--skipFormat', () => {
    it('should format files', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await applicationGenerator(tree, {
        directory: appDirectory,
        addPlugin: true,
      });

      expect(devkit.formatFiles).toHaveBeenCalled();
    });

    it('should not format files when --skipFormat=true', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await applicationGenerator(tree, {
        directory: appDirectory,
        skipFormat: true,
        addPlugin: true,
      });

      expect(devkit.formatFiles).not.toHaveBeenCalled();
    });
  });

  describe('--e2e-test-runner none', () => {
    it('should not generate e2e test project', async () => {
      await applicationGenerator(tree, {
        directory: appDirectory,
        e2eTestRunner: 'none',
        addPlugin: true,
      });

      const projectConfigurations = devkit.getProjects(tree);

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
      });

      expect(readJson(tree, 'tsconfig.json').references).toMatchInlineSnapshot(`
        [
          {
            "path": "./myapp-e2e",
          },
          {
            "path": "./myapp",
          },
        ]
      `);
      expect(readJson(tree, 'myapp/package.json')).toMatchInlineSnapshot(`
        {
          "name": "@proj/myapp",
          "nx": {
            "name": "myapp",
            "projectType": "application",
            "sourceRoot": "myapp/src",
            "targets": {
              "build": {
                "configurations": {
                  "development": {
                    "args": [
                      "node-env=development",
                    ],
                  },
                },
                "executor": "nx:run-commands",
                "options": {
                  "args": [
                    "node-env=production",
                  ],
                  "command": "webpack-cli build",
                },
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
            "module": "nodenext",
            "moduleResolution": "nodenext",
            "outDir": "out-tsc/myapp",
            "rootDir": "src",
            "target": "es2021",
            "tsBuildInfoFile": "out-tsc/myapp/tsconfig.app.tsbuildinfo",
            "types": [
              "node",
            ],
          },
          "exclude": [
            "out-tsc",
            "dist",
            "jest.config.ts",
            "src/**/*.spec.ts",
            "src/**/*.test.ts",
            "eslint.config.js",
            "eslint.config.cjs",
            "eslint.config.mjs",
          ],
          "extends": "../tsconfig.base.json",
          "include": [
            "src/**/*.ts",
          ],
        }
      `);
      expect(readJson(tree, 'myapp/tsconfig.spec.json')).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "emitDecoratorMetadata": true,
            "experimentalDecorators": true,
            "module": "nodenext",
            "moduleResolution": "nodenext",
            "outDir": "./out-tsc/jest",
            "types": [
              "jest",
              "node",
            ],
          },
          "extends": "../tsconfig.base.json",
          "include": [
            "jest.config.ts",
            "src/**/*.test.ts",
            "src/**/*.spec.ts",
            "src/**/*.d.ts",
          ],
          "references": [
            {
              "path": "./tsconfig.app.json",
            },
          ],
        }
      `);
    });
  });
});
