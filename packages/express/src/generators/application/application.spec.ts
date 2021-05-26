import { readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { applicationGenerator } from './application';
import { Schema } from './schema';

describe('app', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace();
  });

  it('should generate files', async () => {
    await applicationGenerator(appTree, {
      name: 'myNodeApp',
    } as Schema);

    const mainFile = appTree.read('apps/my-node-app/src/main.ts').toString();
    expect(mainFile).toContain(`import * as express from 'express';`);

    const tsconfig = readJson(appTree, 'apps/my-node-app/tsconfig.json');
    expect(tsconfig).toMatchInlineSnapshot(`
      Object {
        "extends": "../../tsconfig.base.json",
        "files": Array [],
        "include": Array [],
        "references": Array [
          Object {
            "path": "./tsconfig.app.json",
          },
          Object {
            "path": "./tsconfig.spec.json",
          },
        ],
      }
    `);

    const eslintrcJson = readJson(appTree, 'apps/my-node-app/.eslintrc.json');
    expect(eslintrcJson).toMatchInlineSnapshot(`
      Object {
        "extends": Array [
          "../../.eslintrc.json",
        ],
        "ignorePatterns": Array [
          "!**/*",
        ],
        "overrides": Array [
          Object {
            "files": Array [
              "*.ts",
              "*.tsx",
              "*.js",
              "*.jsx",
            ],
            "rules": Object {},
          },
          Object {
            "files": Array [
              "*.ts",
              "*.tsx",
            ],
            "rules": Object {},
          },
          Object {
            "files": Array [
              "*.js",
              "*.jsx",
            ],
            "rules": Object {},
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
      Object {
        "compilerOptions": Object {
          "module": "commonjs",
          "outDir": "../../dist/out-tsc",
          "types": Array [
            "node",
            "express",
          ],
        },
        "exclude": Array [
          "**/*.spec.ts",
        ],
        "extends": "./tsconfig.json",
        "include": Array [
          "**/*.ts",
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
        `import * as express from 'express';`
      );

      const tsConfig = readJson(appTree, 'apps/my-node-app/tsconfig.json');
      expect(tsConfig.compilerOptions).toEqual({
        allowJs: true,
      });

      const tsConfigApp = readJson(
        appTree,
        'apps/my-node-app/tsconfig.app.json'
      );
      expect(tsConfigApp.include).toEqual(['**/*.ts', '**/*.js']);
      expect(tsConfigApp.exclude).toEqual(['**/*.spec.ts', '**/*.spec.js']);
    });
  });
});
