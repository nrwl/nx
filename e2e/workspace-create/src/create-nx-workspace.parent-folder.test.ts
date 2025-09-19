import {
  cleanupProject,
  e2eCwd,
  getSelectedPackageManager,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e-utils';
import { existsSync, mkdirSync } from 'fs-extra';

describe('create-nx-workspace parent folder', () => {
  const tmpDir = `${e2eCwd}/${uniq('with space')}`;
  const wsName = uniq('parent');
  const packageManager = getSelectedPackageManager() || 'pnpm';

  afterEach(() => cleanupProject({ cwd: `${tmpDir}/${wsName}` }));

  it('should handle spaces in workspace path', () => {
    mkdirSync(tmpDir, { recursive: true });

    runCreateWorkspace(wsName, {
      preset: 'apps',
      packageManager,
      cwd: tmpDir,
    });

    expect(existsSync(`${tmpDir}/${wsName}/package.json`)).toBeTruthy();
  });
});


