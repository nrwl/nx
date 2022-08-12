import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyV1Workspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { createFiles } from './create-files';

describe('Create Files', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyV1Workspace();
  });

  it('should generate files', () => {
    createFiles(tree, {
      name: 'my-app-e2e',
      projectName: 'my-app-e2e',
      projectDirectory: 'apps',
      projectRoot: 'apps/my-app-e2e',
      project: 'my-app',
      appFileName: 'my-app',
      appClassName: 'MyApp',
      appDisplayName: 'MyApp',
      linter: Linter.EsLint,
      framework: 'react-native',
    });

    expect(tree.exists('apps/my-app-e2e/.detoxrc.json')).toBeTruthy();
    expect(tree.exists('apps/my-app-e2e/tsconfig.json')).toBeTruthy();
    expect(tree.exists('apps/my-app-e2e/tsconfig.e2e.json')).toBeTruthy();
    expect(tree.exists('apps/my-app-e2e/test-setup.ts')).toBeTruthy();
  });
});
