import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';
import { readJsonInTree } from '@nrwl/workspace';

describe('app', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
  });

  it('should generate files', async () => {
    const tree = await runSchematic('app', { name: 'myNodeApp' }, appTree);
    expect(tree.readContent('apps/my-node-app/src/main.ts')).toContain(
      `await NestFactory.create(AppModule);`
    );
    expect(tree.exists('apps/my-node-app/src/app/app.module.ts')).toBeTruthy();

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

  it('should have es2015 as the tsconfig target', async () => {
    const tree = await runSchematic('app', { name: 'myNodeApp' }, appTree);
    const tsconfig = readJsonInTree(tree, 'apps/my-node-app/tsconfig.app.json');
    expect(tsconfig.compilerOptions.target).toBe('es2015');
  });

  describe('--linter', () => {
    describe('tslint', () => {
      it('should generate files', async () => {
        const tree = await runSchematic(
          'app',
          { name: 'myNodeApp', linter: 'tslint' },
          appTree
        );

        const tslintJson = readJsonInTree(tree, 'apps/my-node-app/tslint.json');
        expect(tslintJson).toMatchInlineSnapshot(`
          Object {
            "extends": "../../tslint.json",
            "linterOptions": Object {
              "exclude": Array [
                "!**/*",
              ],
            },
            "rules": Object {},
          }
        `);
      });
    });
  });
});
