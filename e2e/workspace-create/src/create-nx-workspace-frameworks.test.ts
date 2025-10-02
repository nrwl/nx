import {
  checkFilesExist,
  cleanupProject,
  expectCodeIsFormatted,
  expectNoAngularDevkit,
  getSelectedPackageManager,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e-utils';

describe('create-nx-workspace --preset=next/vue/nuxt', () => {
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
    checkFilesExist('src/app.vue');
    checkFilesExist('src/pages/index.vue');
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
