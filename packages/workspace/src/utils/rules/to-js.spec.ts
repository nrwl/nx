import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic, callRule } from '../../utils/testing';
import { toJS } from './to-js';

describe('--js flag util function', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = createEmptyWorkspace(Tree.empty());
  });

  test('replace files with .ts extensions with .js extension', async () => {
    const tree = await runSchematic('lib', { name: 'myLib' }, appTree);
    const indexFileBefore = tree.read('/libs/my-lib/src/index.ts');
    expect(indexFileBefore).not.toBeNull();

    const resultTree = await callRule(toJS, tree);

    const indexTSFileAfter = resultTree.read('/libs/my-lib/src/index.ts');
    const indexJSFileAfter = resultTree.read('/libs/my-lib/src/index.js');
    expect(indexTSFileAfter).toBeNull();
    expect(indexJSFileAfter).not.toBeNull();
  });

  test('replace files with .tsx extensions with .js extension', async () => {
    const tree = await runSchematic('lib', { name: 'myLib' }, appTree);
    tree.create(
      '/libs/my-lib/src/component.tsx',
      `export const = () => <h1>Hello World!</h1>`
    );
    const indexFileBefore = tree.read('/libs/my-lib/src/component.tsx');
    expect(indexFileBefore).not.toBeNull();

    const resultTree = await callRule(toJS, tree);

    const indexTSFileAfter = resultTree.read('/libs/my-lib/src/component.tsx');
    const indexJSFileAfter = resultTree.read('/libs/my-lib/src/component.js');
    expect(indexTSFileAfter).toBeNull();
    expect(indexJSFileAfter).not.toBeNull();
  });

  test('replace files with .ts content with .js content', async () => {
    appTree.create(
      '/libs/my-lib/src/index.ts',
      `const coll: number[] = [1, 2, 3];\n`
    );
    const resultTree = await callRule(toJS, appTree);
    const jsResult = resultTree
      .read('/libs/my-lib/src/index.js')
      .toString('utf-8');

    expect(jsResult).toBe(`const coll = [1, 2, 3];\n`);
  });

  test('replace files with .tsx content with .js content', async () => {
    appTree.create(
      '/libs/my-lib/src/component.tsx',
      `export const HelloWorld = (name: string) => <h1>Hello {name}!</h1>;\n`
    );
    const resultTree = await callRule(toJS, appTree);
    const jsxResult = resultTree
      .read('/libs/my-lib/src/component.js')
      .toString('utf-8');

    expect(jsxResult).toBe(
      `export const HelloWorld = (name) => <h1>Hello {name}!</h1>;\n`
    );
  });

  test('replace config strings that end in .ts or .tsx with .js', async () => {
    const tree = await runSchematic('lib', { name: 'myLib' }, appTree);

    const before = tree.read('/tsconfig.base.json').toString('utf-8');
    expect(before).toContain(`"@proj/my-lib": ["libs/my-lib/src/index.ts"]`);

    const resultTree = await callRule(toJS, tree);

    const after = resultTree.read('/tsconfig.base.json').toString('utf-8');

    expect(after).not.toContain(`"@proj/my-lib": ["libs/my-lib/src/index.ts"]`);
    expect(after).toContain(`"@proj/my-lib": ["libs/my-lib/src/index.js"]`);
  });

  test('do not replace other instances of .ts or .tsx with .js', async () => {
    appTree.create(
      '/libs/my-lib/src/README.md',
      `I like an index.ts way more than a index.js`
    );
    const resultTree = await callRule(toJS, appTree);
    const mdResult = resultTree
      .read('/libs/my-lib/src/README.md')
      .toString('utf-8');

    expect(mdResult).toBe(`I like an index.ts way more than a index.js`);
  });
});
