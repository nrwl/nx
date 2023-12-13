import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { getDefaultExportName } from './get-default-export-name';

describe('getDefaultExportName', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('.gitignore', `/node_modules/dist`);
  });

  it("should get the default export's name", () => {
    tree.write(
      'component.tsx',
      `export default function Component() { return (<p>Hello world!</p>); };`
    );

    const defaultExportName = getDefaultExportName(tree, 'component.tsx');

    expect(defaultExportName).toEqual('Component');
  });

  it("should return 'Unknown' if there is no default export", () => {
    tree.write('util.ts', `export  function util() { return 'hello world'; };`);

    const defaultExportName = getDefaultExportName(tree, 'util.ts');

    expect(defaultExportName).toEqual('Unknown');
  });
});
