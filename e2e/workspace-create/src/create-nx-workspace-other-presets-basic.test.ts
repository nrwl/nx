import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  expectNoAngularDevkit,
  expectCodeIsFormatted,
  getSelectedPackageManager,
  packageManagerLockFile,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e-utils';

describe('create-nx-workspace --preset=other - Basic Presets', () => {
  const packageManager = getSelectedPackageManager() || 'pnpm';

  afterEach(() => cleanupProject());

  it('should reject workspace names starting with numbers', () => {
    expect(() => {
      runCreateWorkspace('4invalidname', {
        preset: 'apps',
        packageManager,
      });
    }).toThrow();
  });

  it('should be able to create an empty workspace built for apps', () => {
    const wsName = uniq('apps');
    runCreateWorkspace(wsName, {
      preset: 'apps',
      packageManager,
    });

    checkFilesExist('package.json', packageManagerLockFile[packageManager]);

    expectNoAngularDevkit();
  });

  it('should be able to create an empty workspace with npm capabilities', () => {
    const wsName = uniq('npm');
    runCreateWorkspace(wsName, {
      preset: 'npm',
      packageManager,
    });

    expectNoAngularDevkit();
    checkFilesDoNotExist('tsconfig.base.json');
  });

  it('should be able to create an empty workspace with ts/js capabilities', () => {
    const wsName = uniq('ts');
    runCreateWorkspace(wsName, {
      preset: 'ts',
      packageManager,
    });

    expectNoAngularDevkit();
    expectCodeIsFormatted();
  });
});
