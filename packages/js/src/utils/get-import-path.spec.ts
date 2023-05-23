import { getImportPath } from './get-import-path';
import { Tree, writeJson } from '@nx/devkit';
import { createTree } from '@nx/devkit/testing-pre16';

describe('getImportPath', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
  });

  it('should use the npmScope if it is set to anything other than @', () => {
    writeJson(tree, 'package.json', {
      name: '@myorg/source',
    });
    expect(getImportPath(tree, 'my-package')).toEqual('@myorg/my-package');
  });

  it('should just use the package name if npmScope is empty', () => {
    writeJson(tree, 'package.json', {
      name: 'source',
    });
    expect(getImportPath(tree, 'my-package')).toEqual('my-package');
  });
});
