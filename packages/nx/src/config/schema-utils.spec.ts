vi.mock('../plugins/js/utils/register', () => ({
  loadTsFile: vi.fn(() => ({ default: 'loaded' })),
  registerSourceGraphResolver: vi.fn(),
  requireWithTsconfigFallback: vi.fn(),
}));

vi.mock('../plugins/js/utils/packages', () => ({
  getWorkspacePackagesMetadata: vi.fn(() => ({
    packageToProjectMap: {},
    packageManagerWorkspacePackageNames: [],
  })),
}));

import { join } from 'node:path';
import { registerSourceGraphResolver } from '../plugins/js/utils/register';
import { workspaceRoot } from '../utils/workspace-root';
import { getImplementationFactory } from './schema-utils';

describe('getImplementationFactory', () => {
  it('registers workspace-local TypeScript implementations as source', () => {
    const directory = join(workspaceRoot, 'packages/nx/src');

    getImplementationFactory(
      './project-graph/plugins/resolve-plugin',
      directory,
      'local-plugin',
      {}
    )();

    expect(registerSourceGraphResolver).toHaveBeenCalledWith(
      join(directory, 'project-graph/plugins/resolve-plugin.ts'),
      workspaceRoot,
      []
    );
  });
});
