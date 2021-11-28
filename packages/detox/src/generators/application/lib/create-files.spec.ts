import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { createFiles } from './create-files';

describe('Create Files', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should generate files', () => {
    createFiles(tree, {
      name: 'my-app-e2e',
      projectName: 'my-app-e2e',
      projectRoot: 'apps/my-app-e2e',
      project: 'my-app',
      appFileName: 'my-app',
      appClassName: 'MyApp',
      linter: Linter.EsLint,
      js: false,
      type: 'react-native',
      skipFormat: false,
      setParserOptionsProject: false,
    });

    expect(tree.exists('apps/my-app-e2e/.detoxrc.json')).toBeTruthy();
    expect(tree.exists('apps/my-app-e2e/tsconfig.json')).toBeTruthy();
    expect(tree.exists('apps/my-app-e2e/tsconfig.e2e.json')).toBeTruthy();
    expect(tree.exists('apps/my-app-e2e/test-setup.ts')).toBeTruthy();
  });
});
