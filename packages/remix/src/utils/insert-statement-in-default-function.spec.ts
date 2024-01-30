import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { insertStatementInDefaultFunction } from './insert-statement-in-default-function';

describe('insertStatementInDefaultFunction', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('.gitignore', `/node_modules/dist`);
  });

  it('should insert statement in default function', () => {
    tree.write(
      'component.tsx',
      `export default function Component() { return (<p>Hello world!</p>); };`
    );

    insertStatementInDefaultFunction(
      tree,
      'component.tsx',
      `const someVar = "whatever";`
    );

    expect(tree.read('component.tsx', 'utf-8')).toMatchInlineSnapshot(
      `"export default function Component() {const someVar = "whatever"; return (<p>Hello world!</p>); };"`
    );
  });

  it('should throw if there is no default export', () => {
    tree.write('util.ts', `export function hello() { return 'helloWorld'; }`);
    expect(() =>
      insertStatementInDefaultFunction(
        tree,
        'util.ts',
        `const someVar = "whatever";`
      )
    ).toThrowErrorMatchingInlineSnapshot(`"No default export found!"`);
  });
});
