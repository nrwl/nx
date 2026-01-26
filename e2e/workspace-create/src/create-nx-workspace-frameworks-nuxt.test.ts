import {
  checkFilesExist,
  cleanupProject,
  expectCodeIsFormatted,
  getSelectedPackageManager,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e-utils';

describe('create-nx-workspace --preset=nuxt', () => {
  const packageManager = getSelectedPackageManager() || 'pnpm';

  afterEach(() => cleanupProject());

  it('should create a workspace with a single nuxt app at the root', () => {
    const wsName = uniq('nuxt');

    runCreateWorkspace(wsName, {
      preset: 'nuxt-standalone',
      appName: wsName,
      style: 'css',
      packageManager,
      e2eTestRunner: 'none',
    });

    checkFilesExist('package.json');
    checkFilesExist('project.json');
    checkFilesExist('nuxt.config.ts');
    checkFilesExist('app/app.vue');
    checkFilesExist('app/pages/index.vue');
    expectCodeIsFormatted();
  });

  it('should be able to create a nuxt monorepo', () => {
    const wsName = uniq('nuxt');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'nuxt',
      appName,
      style: 'css',
      packageManager,
      e2eTestRunner: 'none',
    });
    expectCodeIsFormatted();
  });
});
