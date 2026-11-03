import { type Tree } from '@nx/devkit';
import { withPnpm } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { ensureDependencies } from './ensure-dependencies';

describe('ensureDependencies', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should deny the @swc/core build script pulled in by the react swc plugin', async () => {
    await withPnpm(tree, '11.2.2', () =>
      ensureDependencies(tree, { uiFramework: 'react', compiler: 'swc' })
    );

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toMatch(
      /['"]@swc\/core['"]: false/
    );
  });

  it('should not record a @swc/core decision for the babel react plugin', async () => {
    await withPnpm(tree, '11.2.2', () =>
      ensureDependencies(tree, { uiFramework: 'react' })
    );

    expect(tree.read('pnpm-workspace.yaml', 'utf-8') ?? '').not.toContain(
      '@swc/core'
    );
  });
});
