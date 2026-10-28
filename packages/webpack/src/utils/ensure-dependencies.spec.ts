import { type Tree } from '@nx/devkit';
import { withPnpm } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { ensureDependencies } from './ensure-dependencies';

describe('ensureDependencies', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should deny the core-js-pure build script pulled in by the react refresh plugin', () => {
    withPnpm(tree, '11.2.2', () =>
      ensureDependencies(tree, { uiFramework: 'react' })
    );

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toMatch(
      /['"]?core-js-pure['"]?: false/
    );
  });

  it('should not record a core-js-pure decision without react', () => {
    withPnpm(tree, '11.2.2', () =>
      ensureDependencies(tree, { uiFramework: 'none' })
    );

    expect(tree.read('pnpm-workspace.yaml', 'utf-8') ?? '').not.toContain(
      'core-js-pure'
    );
  });
});
