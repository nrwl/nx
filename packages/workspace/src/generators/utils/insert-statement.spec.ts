import { Tree } from '@nrwl/devkit';
import { createTree } from '@nrwl/devkit/testing';
import { insertStatement } from './insert-statement';

describe('insertStatement', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
  });

  it('should insert a statement after the last import', () => {
    tree.write('index.ts', `import { a } from 'a';`);

    insertStatement(tree, 'index.ts', 'const b = 0;');

    expect(tree.read('index.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { a } from 'a';
      const b = 0;"
    `);
  });

  it('should insert a statement at the beginning if there are no imports', () => {
    tree.write('index.ts', `const a = 0;`);

    insertStatement(tree, 'index.ts', 'const b = 0;\n');

    expect(tree.read('index.ts', 'utf-8')).toMatchInlineSnapshot(`
      "const b = 0;
      const a = 0;"
    `);
  });
});
