import {
  checkFilesExist,
  cleanupProject,
  expectCodeIsFormatted,
  getSelectedPackageManager,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e-utils';

describe('create-nx-workspace --preset=vue', () => {
  const packageManager = getSelectedPackageManager() || 'pnpm';

  afterEach(() => cleanupProject());

  it('should create a workspace with a single vue app at the root', () => {
    const wsName = uniq('vue');

    runCreateWorkspace(wsName, {
      preset: 'vue-standalone',
      appName: wsName,
      style: 'css',
      packageManager,
      e2eTestRunner: 'none',
    });

    checkFilesExist('package.json');
    checkFilesExist('project.json');
    checkFilesExist('index.html');
    checkFilesExist('src/main.ts');
    checkFilesExist('src/app/App.vue');
    expectCodeIsFormatted();
  });

  it('should be able to create a vue monorepo', () => {
    const wsName = uniq('vue');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'vue-monorepo',
      appName,
      style: 'css',
      packageManager,
      e2eTestRunner: 'none',
    });
    expectCodeIsFormatted();
  });
});
