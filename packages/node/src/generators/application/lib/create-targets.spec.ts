import { getPruneTargets } from './create-targets';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  detectPackageManager: jest.fn(),
}));

import { detectPackageManager } from '@nx/devkit';

describe('getPruneTargets', () => {
  afterEach(() => jest.resetAllMocks());

  it('declares the pnpm-workspace.yaml and patches outputs on pnpm', () => {
    // The prune-lockfile executor emits pnpm-workspace.yaml (pnpm 11+ settings)
    // and any `pnpm patch` files under patches/; both must be declared outputs or
    // a cache replay drops them.
    (detectPackageManager as jest.Mock).mockReturnValue('pnpm');

    const targets = getPruneTargets('build', 'dist/my-app');

    expect(targets['prune-lockfile'].outputs).toEqual([
      '{workspaceRoot}/dist/my-app/package.json',
      '{workspaceRoot}/dist/my-app/pnpm-lock.yaml',
      '{workspaceRoot}/dist/my-app/pnpm-workspace.yaml',
      '{workspaceRoot}/dist/my-app/patches',
    ]);
  });

  it('declares only package.json and the lockfile on npm', () => {
    (detectPackageManager as jest.Mock).mockReturnValue('npm');

    const targets = getPruneTargets('build', 'dist/my-app');

    expect(targets['prune-lockfile'].outputs).toEqual([
      '{workspaceRoot}/dist/my-app/package.json',
      '{workspaceRoot}/dist/my-app/package-lock.json',
    ]);
  });
});
