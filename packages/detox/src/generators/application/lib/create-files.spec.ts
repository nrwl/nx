import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
import { createFiles } from './create-files';

describe('Create Files', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should generate files', () => {
    createFiles(tree, {
      e2eName: 'my-app-e2e',
      e2eProjectName: 'my-app-e2e',
      e2eProjectDirectory: 'apps',
      e2eProjectRoot: 'apps/my-app-e2e',
      appProject: 'my-app',
      appFileName: 'my-app',
      appClassName: 'MyApp',
      appDisplayName: 'MyApp',
      appExpoName: 'MyApp',
      appRoot: 'apps/my-app',
      linter: Linter.EsLint,
      framework: 'react-native',
    });

    expect(tree.exists('apps/my-app-e2e/.detoxrc.json')).toBeTruthy();
    expect(tree.exists('apps/my-app-e2e/tsconfig.json')).toBeTruthy();
    expect(tree.exists('apps/my-app-e2e/tsconfig.e2e.json')).toBeTruthy();
    expect(tree.exists('apps/my-app-e2e/test-setup.ts')).toBeTruthy();
  });
});
