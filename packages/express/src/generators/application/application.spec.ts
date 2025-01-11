import { readJson, Tree, updateJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { applicationGenerator } from './application';
import { Schema } from './schema';

describe('app', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace();
  });

  it('should generate files', async () => {
    await applicationGenerator(appTree, {
      directory: 'my-node-app',
    } as Schema);

    const mainFile = appTree.read('my-node-app/src/main.ts').toString();
    expect(mainFile).toContain(`import express from 'express';`);

    const tsconfig = readJson(appTree, 'my-node-app/tsconfig.json');
    expect(tsconfig).toMatchInlineSnapshot(`
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

    const eslintrcJson = readJson(appTree, 'my-node-app/.eslintrc.json');
    expect(eslintrcJson).toMatchInlineSnapshot(`
      {
        "extends": [
          "../.eslintrc.json",
        ],
        "ignorePatterns": [
          "!**/*",
        ],
        "overrides": [
          {
            "files": [
              "*.ts",
              "*.tsx",
              "*.js",
              "*.jsx",
            ],
            "rules": {},
          },
          {
            "files": [
              "*.ts",
              "*.tsx",
            ],
            "rules": {},
          },
          {
            "files": [
              "*.js",
              "*.jsx",
            ],
            "rules": {},
          },
        ],
      }
    `);
  });

  it('should add types to the tsconfig.app.json', async () => {
    await applicationGenerator(appTree, {
      directory: 'my-node-app',
    } as Schema);
    const tsconfig = readJson(appTree, 'my-node-app/tsconfig.app.json');
    expect(tsconfig.compilerOptions.types).toContain('express');
    expect(tsconfig).toMatchInlineSnapshot(`
      {
        "compilerOptions": {
          "module": "commonjs",
          "outDir": "../dist/out-tsc",
          "types": [
            "node",
            "express",
          ],
        },
        "exclude": [
          "jest.config.ts",
          "src/**/*.spec.ts",
          "src/**/*.test.ts",
        ],
        "extends": "./tsconfig.json",
        "include": [
          "src/**/*.ts",
        ],
      }
    `);
  });

  describe('--js flag', () => {
    it('should generate js files instead of ts files', async () => {
      await applicationGenerator(appTree, {
        directory: 'my-node-app',
        js: true,
      } as Schema);

      expect(appTree.exists('my-node-app/src/main.js')).toBeTruthy();
      expect(appTree.read('my-node-app/src/main.js').toString()).toContain(
        `import express from 'express';`
      );

      const tsConfig = readJson(appTree, 'my-node-app/tsconfig.json');
      expect(tsConfig.compilerOptions).toEqual({
        allowJs: true,
        esModuleInterop: true,
      });

      const tsConfigApp = readJson(appTree, 'my-node-app/tsconfig.app.json');
      expect(tsConfigApp.include).toEqual(['src/**/*.ts', 'src/**/*.js']);
      expect(tsConfigApp.exclude).toEqual([
        'jest.config.js',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.js',
        'src/**/*.test.js',
      ]);
    });
  });

  describe('TS solution setup', () => {
    beforeEach(() => {
      appTree = createTreeWithEmptyWorkspace();
      updateJson(appTree, 'package.json', (json) => {
        json.workspaces = ['packages/*', 'apps/*'];
        return json;
      });
      writeJson(appTree, 'tsconfig.base.json', {
        compilerOptions: {
          composite: true,
          declaration: true,
        },
      });
      writeJson(appTree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        files: [],
        references: [],
      });
    });

    it('should add project references when using TS solution', async () => {
      await applicationGenerator(appTree, {
        directory: 'myapp',
      } as Schema);

      expect(readJson(appTree, 'tsconfig.json').references)
        .toMatchInlineSnapshot(`
        [
          {
            "path": "./myapp-e2e",
          },
          {
            "path": "./myapp",
          },
        ]
      `);
      expect(readJson(appTree, 'myapp/package.json')).toMatchInlineSnapshot(`
        {
          "name": "@proj/myapp",
          "nx": {
            "name": "myapp",
            "projectType": "application",
            "sourceRoot": "myapp/src",
            "targets": {
              "build": {
                "configurations": {
                  "development": {},
                  "production": {},
                },
                "defaultConfiguration": "production",
                "executor": "@nx/webpack:webpack",
                "options": {
                  "assets": [
                    "myapp/src/assets",
                  ],
                  "compiler": "tsc",
                  "main": "myapp/src/main.ts",
                  "outputPath": "dist/myapp",
                  "target": "node",
                  "tsConfig": "myapp/tsconfig.app.json",
                  "webpackConfig": "myapp/webpack.config.js",
                },
                "outputs": [
                  "{options.outputPath}",
                ],
              },
              "lint": {
                "executor": "@nx/eslint:lint",
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
      expect(readJson(appTree, 'myapp/tsconfig.json')).toMatchInlineSnapshot(`
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
      expect(readJson(appTree, 'myapp/tsconfig.app.json'))
        .toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "module": "nodenext",
            "moduleResolution": "nodenext",
            "outDir": "out-tsc/myapp",
            "rootDir": "src",
            "tsBuildInfoFile": "out-tsc/myapp/tsconfig.app.tsbuildinfo",
            "types": [
              "node",
              "express",
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
      expect(readJson(appTree, 'myapp/tsconfig.spec.json'))
        .toMatchInlineSnapshot(`
        {
          "compilerOptions": {
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
