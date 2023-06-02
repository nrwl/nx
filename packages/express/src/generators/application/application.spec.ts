import { readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { applicationGenerator } from './application';
import { Schema } from './schema';

describe('app', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should generate files', async () => {
    await applicationGenerator(appTree, {
      name: 'myNodeApp',
    } as Schema);

    const mainFile = appTree.read('apps/my-node-app/src/main.ts').toString();
    expect(mainFile).toContain(`import express from 'express';`);

    const tsconfig = readJson(appTree, 'apps/my-node-app/tsconfig.json');
    expect(tsconfig).toMatchInlineSnapshot(`
      {
        "compilerOptions": {
          "esModuleInterop": true,
        },
        "extends": "../../tsconfig.base.json",
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

    const eslintrcJson = readJson(appTree, 'apps/my-node-app/.eslintrc.json');
    expect(eslintrcJson).toMatchInlineSnapshot(`
      {
        "extends": [
          "../../.eslintrc.json",
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
      name: 'myNodeApp',
    } as Schema);
    const tsconfig = readJson(appTree, 'apps/my-node-app/tsconfig.app.json');
    expect(tsconfig.compilerOptions.types).toContain('express');
    expect(tsconfig).toMatchInlineSnapshot(`
      {
        "compilerOptions": {
          "module": "commonjs",
          "outDir": "../../dist/out-tsc",
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
        name: 'myNodeApp',
        js: true,
      } as Schema);

      expect(appTree.exists('apps/my-node-app/src/main.js')).toBeTruthy();
      expect(appTree.read('apps/my-node-app/src/main.js').toString()).toContain(
        `import express from 'express';`
      );

      const tsConfig = readJson(appTree, 'apps/my-node-app/tsconfig.json');
      expect(tsConfig.compilerOptions).toEqual({
        allowJs: true,
        esModuleInterop: true,
      });

      const tsConfigApp = readJson(
        appTree,
        'apps/my-node-app/tsconfig.app.json'
      );
      expect(tsConfigApp.include).toEqual(['src/**/*.ts', 'src/**/*.js']);
      expect(tsConfigApp.exclude).toEqual([
        'jest.config.ts',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.js',
        'src/**/*.test.js',
      ]);
    });
  });
});
