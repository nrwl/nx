import {
  checkFilesExist,
  cleanupProject,
  expectCodeIsFormatted,
  expectNoAngularDevkit,
  getSelectedPackageManager,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e-utils';

describe('create-nx-workspace next', () => {
  const packageManager = getSelectedPackageManager() || 'pnpm';

  afterEach(() => cleanupProject());

  it('should be able to create an next workspace', () => {
    const wsName = uniq('next');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'next',
      style: 'css',
      appName,
      nextAppDir: false,
      nextSrcDir: true,
      packageManager,
      e2eTestRunner: 'none',
    });

    checkFilesExist(`apps/${appName}/src/pages/index.tsx`);

    expectNoAngularDevkit();
    expectCodeIsFormatted();
  });

  it('should be able to create a nextjs standalone workspace using app router', () => {
    const wsName = uniq('next');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'nextjs-standalone',
      style: 'css',
      nextAppDir: true,
      nextSrcDir: true,
      appName,
      packageManager,
      e2eTestRunner: 'none',
    });

    checkFilesExist('src/app/page.tsx');

    expectNoAngularDevkit();
    expectCodeIsFormatted();
  });

  it('should be able to create a nextjs standalone workspace using pages router', () => {
    const wsName = uniq('next');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'nextjs-standalone',
      style: 'css',
      nextAppDir: false,
      nextSrcDir: true,
      appName,
      packageManager,
      e2eTestRunner: 'none',
    });

    checkFilesExist('src/pages/index.tsx');

    expectNoAngularDevkit();
    expectCodeIsFormatted();
  });
});
