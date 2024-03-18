import { addDependenciesToPackageJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { tsquery } from '@phenomnomnominal/tsquery';
import { mockViteReactAppGenerator } from '../../utils/test-utils';
import { removeProjectsFromViteTsConfigPaths } from './update-vite-tsconfig-paths';

describe('remove projects from vite-tsconfig-paths', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    mockViteReactAppGenerator(tree);
    const existing = 'existing';
    const existingVersion = '1.0.0';
    addDependenciesToPackageJson(
      tree,
      { 'vite-tsconfig-paths': '^3.6.0', [existing]: existingVersion },
      { [existing]: existingVersion }
    );
  });

  it('should remove the projects attribute from vite-tsconfig-paths', async () => {
    await removeProjectsFromViteTsConfigPaths(tree);
    const appFileContent = tree.read(
      'apps/my-test-react-vite-app/vite.config.ts',
      'utf-8'
    );
    const file = tsquery.ast(appFileContent);

    expect(file.getText().includes('tsconfig.base.json')).toBeFalsy();
    expect(file.getText().includes('projects')).toBeFalsy();
  });
});
