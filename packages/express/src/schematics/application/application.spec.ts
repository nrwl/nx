import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';
import { readJsonInTree } from '@nrwl/workspace';

import { Schema } from './schema.d';

describe('app', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
  });

  it('should generate files', async () => {
    const tree = await runSchematic(
      'app',
      { name: 'myNodeApp' } as Schema,
      appTree
    );

    const mainFile = tree.readContent('apps/my-node-app/src/main.ts');
    expect(mainFile).toContain(`import * as express from 'express';`);

    const tsconfig = readJsonInTree(tree, 'apps/my-node-app/tsconfig.json');
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

    const eslintrcJson = readJsonInTree(
      tree,
      'apps/my-node-app/.eslintrc.json'
    );
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
            "parserOptions": Object {
              "project": Array [
                "apps/my-node-app/tsconfig.*?.json",
              ],
            },
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
    const tree = await runSchematic(
      'app',
      { name: 'myNodeApp' } as Schema,
      appTree
    );
    const tsconfig = readJsonInTree(tree, 'apps/my-node-app/tsconfig.app.json');
    expect(tsconfig.compilerOptions.types).toContain('express');
    expect(tsconfig).toMatchInlineSnapshot(`
      Object {
        "compilerOptions": Object {
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
      const tree = await runSchematic(
        'app',
        {
          name: 'myNodeApp',
          js: true,
        } as Schema,
        appTree
      );

      expect(tree.exists('apps/my-node-app/src/main.js')).toBeTruthy();
      expect(tree.readContent('apps/my-node-app/src/main.js')).toContain(
        `import * as express from 'express';`
      );

      const tsConfig = readJsonInTree(tree, 'apps/my-node-app/tsconfig.json');
      expect(tsConfig.compilerOptions).toEqual({
        allowJs: true,
      });

      const tsConfigApp = readJsonInTree(
        tree,
        'apps/my-node-app/tsconfig.app.json'
      );
      expect(tsConfigApp.include).toEqual(['**/*.ts', '**/*.js']);
      expect(tsConfigApp.exclude).toEqual(['**/*.spec.ts', '**/*.spec.js']);
    });
  });
});
