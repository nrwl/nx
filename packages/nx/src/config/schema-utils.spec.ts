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

import { mkdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TempFs } from '../internal-testing-utils/temp-fs';
import { registerSourceGraphResolver } from '../plugins/js/utils/register';
import { setWorkspaceRoot, workspaceRoot } from '../utils/workspace-root';
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

  it('registers a realpath-resolved implementation when the workspace root is an alias', () => {
    const fs = new TempFs('schema-utils-alias-root');
    const real = realpathSync(fs.tempDir);
    const alias = join(fs.tempDir, 'alias');
    const directory = join(real, 'ws/packages/plugin/src');
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'impl.ts'), '');
    symlinkSync(join(real, 'ws'), alias, 'dir');
    const originalRoot = workspaceRoot;
    setWorkspaceRoot(alias);
    try {
      getImplementationFactory('./impl', directory, 'local-plugin', {})();

      expect(registerSourceGraphResolver).toHaveBeenCalledWith(
        join(directory, 'impl.ts'),
        alias,
        []
      );
    } finally {
      setWorkspaceRoot(originalRoot);
      fs.cleanup();
    }
  });
});
