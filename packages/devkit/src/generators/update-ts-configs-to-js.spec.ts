import type { Tree } from 'nx/src/generators/tree';
import { updateTsConfigsToJs } from './update-ts-configs-to-js';
import { createTreeWithEmptyWorkspace } from 'nx/src/generators/testing-utils/create-tree-with-empty-workspace';

describe('updateTsConfigsToJs', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should set allowJs to true in tsconfig.json', () => {
    tree.write('tsconfig.json', `{}`);
    tree.write('tsconfig.lib.json', `{}`);

    updateTsConfigsToJs(tree, { projectRoot: '.' });

    expect(tree.read('tsconfig.json', 'utf-8')).toMatchInlineSnapshot(`
      "{
        "compilerOptions": {
          "allowJs": true
        }
      }
      "
    `);
  });

  it.each`
    tsconfig
    ${'tsconfig.app.json'}
    ${'tsconfig.lib.json'}
  `(
    'should add the relevant include and exclude to $tsconfig',
    ({ tsconfig }) => {
      tree.write('tsconfig.json', `{}`);
      tree.write(
        tsconfig,
        JSON.stringify({
          include: ['src/**/*.ts'],
          exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
        })
      );

      updateTsConfigsToJs(tree, { projectRoot: '.' });

      expect(tree.read(tsconfig, 'utf-8')).toMatchInlineSnapshot(`
        "{
          "include": [
            "src/**/*.ts",
            "src/**/*.js"
          ],
          "exclude": [
            "src/**/*.spec.ts",
            "src/**/*.test.ts",
            "src/**/*.spec.js",
            "src/**/*.test.js"
          ]
        }
        "
      `);
    }
  );

  it.each`
    tsconfig
    ${'tsconfig.app.json'}
    ${'tsconfig.lib.json'}
  `(
    'should update $tsconfig with the relevant include and exclude when those properties are not defined',
    ({ tsconfig }) => {
      tree.write('tsconfig.json', `{}`);
      tree.write(tsconfig, `{}`);

      updateTsConfigsToJs(tree, { projectRoot: '.' });

      expect(tree.read(tsconfig, 'utf-8')).toMatchInlineSnapshot(`
        "{
          "include": [
            "src/**/*.js"
          ],
          "exclude": [
            "src/**/*.spec.js",
            "src/**/*.test.js"
          ]
        }
        "
      `);
    }
  );
});
