import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  e2eCwd,
  expectCodeIsFormatted,
  expectNoAngularDevkit,
  expectNoTsJestInJestConfig,
  getSelectedPackageManager,
  packageManagerLockFile,
  readJson,
  runCommand,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e/utils';
import { readFileSync } from 'fs';
import { existsSync, mkdirSync, rmSync } from 'fs-extra';

describe('create-nx-workspace', () => {
  const packageManager = getSelectedPackageManager() || 'pnpm';

  afterEach(() => cleanupProject());

  it('should create a workspace with a single angular app at the root without routing', () => {
    const wsName = uniq('angular');

    runCreateWorkspace(wsName, {
      preset: 'angular-standalone',
      appName: wsName,
      style: 'css',
      packageManager,
      standaloneApi: false,
      routing: false,
      e2eTestRunner: 'none',
      bundler: 'webpack',
      ssr: false,
    });

    checkFilesExist('package.json');
    checkFilesExist('project.json');
    checkFilesExist('src/app/app.module.ts');
    checkFilesDoNotExist('src/app/app.routes.ts');
    expectCodeIsFormatted();
  });

  it('should create a workspace with a single angular app at the root using standalone APIs', () => {
    const wsName = uniq('angular');

    runCreateWorkspace(wsName, {
      preset: 'angular-standalone',
      appName: wsName,
      style: 'css',
      packageManager,
      standaloneApi: true,
      routing: true,
      e2eTestRunner: 'none',
      bundler: 'webpack',
      ssr: false,
    });

    checkFilesExist('package.json');
    checkFilesExist('project.json');
    checkFilesExist('src/app/app.routes.ts');
    checkFilesDoNotExist('src/app/app.module.ts');
    expectCodeIsFormatted();
  });

  it('should create a workspace with a single react app with vite at the root', () => {
    const wsName = uniq('react');

    runCreateWorkspace(wsName, {
      preset: 'react-standalone',
      appName: wsName,
      style: 'css',
      packageManager,
      bundler: 'vite',
      e2eTestRunner: 'none',
    });

    checkFilesExist('package.json');
    checkFilesExist('project.json');
    checkFilesExist('vite.config.ts');
    checkFilesDoNotExist('tsconfig.base.json');
    expectCodeIsFormatted();
  });

  it('should create a workspace with a single react app with webpack and playwright at the root', () => {
    const wsName = uniq('react');

    runCreateWorkspace(wsName, {
      preset: 'react-standalone',
      appName: wsName,
      style: 'css',
      packageManager,
      bundler: 'webpack',
      e2eTestRunner: 'playwright',
    });

    checkFilesExist('package.json');
    checkFilesExist('project.json');
    checkFilesExist('webpack.config.js');
    checkFilesDoNotExist('tsconfig.base.json');
    expectCodeIsFormatted();
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

  it('should be able to create an angular workspace', () => {
    const wsName = uniq('angular');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'angular-monorepo',
      style: 'css',
      appName,
      packageManager,
      standaloneApi: false,
      routing: true,
      e2eTestRunner: 'none',
      bundler: 'webpack',
      ssr: false,
    });
    expectCodeIsFormatted();
  });

  it('should fail correctly when preset errors', () => {
    // Using Angular Preset as the example here to test
    // It will error when prefix is not valid
    const wsName = uniq('angular-1-test');
    const appName = uniq('app');
    expect(() =>
      runCreateWorkspace(wsName, {
        preset: 'angular-monorepo',
        style: 'css',
        appName,
        packageManager,
        standaloneApi: false,
        routing: false,
        e2eTestRunner: 'none',
        bundler: 'webpack',
        ssr: false,
        prefix: '1-one',
      })
    ).toThrow();
  });

  it('should be able to create a react workspace with webpack', () => {
    const wsName = uniq('react');
    const appName = uniq('app');

    runCreateWorkspace(wsName, {
      preset: 'react-monorepo',
      style: 'css',
      appName,
      packageManager,
      bundler: 'webpack',
      e2eTestRunner: 'none',
    });

    expectNoAngularDevkit();
    expectNoTsJestInJestConfig(appName);
    const packageJson = readJson('package.json');
    expect(packageJson.devDependencies['@nx/webpack']).toBeDefined();
    expectCodeIsFormatted();
  });

  it('should be able to create a react workspace with vite', () => {
    const wsName = uniq('react');
    const appName = uniq('app');

    runCreateWorkspace(wsName, {
      preset: 'react-monorepo',
      style: 'css',
      appName,
      packageManager,
      bundler: 'vite',
      e2eTestRunner: 'none',
    });

    expectNoAngularDevkit();
    const packageJson = readJson('package.json');
    expect(packageJson.devDependencies['@nx/webpack']).not.toBeDefined();
    expect(packageJson.devDependencies['@nx/vite']).toBeDefined();
    expectCodeIsFormatted();
  });

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

  it('should be able to create an web-components workspace', () => {
    const wsName = uniq('web-components');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'web-components',
      style: 'css',
      appName,
      packageManager,
    });

    expectNoAngularDevkit();
    expectCodeIsFormatted();
  });

  it('should be able to create an express workspace', () => {
    const wsName = uniq('express');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'express',
      docker: false,
      appName,
      packageManager,
    });

    expectNoAngularDevkit();
    expectCodeIsFormatted();
  });

  it('should be able to create react-native workspace', () => {
    const wsName = uniq('react-native');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'react-native',
      appName,
      packageManager: 'npm',
    });

    expectNoAngularDevkit();
    expectCodeIsFormatted();
  });

  it('should be able to create an expo workspace', () => {
    const wsName = uniq('expo');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'expo',
      appName,
      packageManager: 'npm',
    });

    expectNoAngularDevkit();
    expectCodeIsFormatted();
  });

  it('should be able to create a workspace with a custom base branch and HEAD', () => {
    const wsName = uniq('branch');
    runCreateWorkspace(wsName, {
      preset: 'apps',
      base: 'main',
      packageManager,
    });
  });

  it('should be able to create a workspace with custom commit information', () => {
    const wsName = uniq('branch');
    runCreateWorkspace(wsName, {
      preset: 'apps',
      extraArgs:
        '--commit.name="John Doe" --commit.email="myemail@test.com" --commit.message="Custom commit message!"',
      packageManager,
    });
  });

  it('should be able to create a nest workspace', () => {
    const wsName = uniq('nest');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'nest',
      docker: false,
      appName,
      packageManager,
    });
    expectCodeIsFormatted();
  });

  it('should respect package manager preference', () => {
    const wsName = uniq('pm');

    process.env.YARN_REGISTRY = `http://localhost:4872`;
    process.env.SELECTED_PM = 'npm';

    runCreateWorkspace(wsName, {
      preset: 'apps',
      packageManager: 'npm',
    });

    checkFilesDoNotExist('yarn.lock');
    checkFilesExist('package-lock.json');
    process.env.SELECTED_PM = packageManager;
  });

  describe('Use detected package manager', () => {
    function setupProject(envPm: 'npm' | 'yarn' | 'pnpm' | 'bun') {
      process.env.SELECTED_PM = envPm;
      runCreateWorkspace(uniq('pm'), {
        preset: 'apps',
        packageManager: envPm,
        useDetectedPm: true,
      });
    }

    if (packageManager === 'npm') {
      it('should use npm when invoked with npx', () => {
        setupProject('npm');
        checkFilesExist(packageManagerLockFile['npm']);
        checkFilesDoNotExist(
          packageManagerLockFile['yarn'],
          packageManagerLockFile['pnpm'],
          packageManagerLockFile['bun']
        );
        process.env.SELECTED_PM = packageManager;
      }, 90000);
    }

    if (packageManager === 'pnpm') {
      it('should use pnpm when invoked with pnpx', () => {
        setupProject('pnpm');
        checkFilesExist(packageManagerLockFile['pnpm']);
        checkFilesDoNotExist(
          packageManagerLockFile['yarn'],
          packageManagerLockFile['npm'],
          packageManagerLockFile['bun']
        );
        process.env.SELECTED_PM = packageManager;
      }, 90000);
    }

    if (packageManager === 'bun') {
      it('should use bun when invoked with bunx', () => {
        setupProject('bun');
        checkFilesExist(packageManagerLockFile['bun']);
        checkFilesDoNotExist(
          packageManagerLockFile['yarn'],
          packageManagerLockFile['npm'],
          packageManagerLockFile['pnpm']
        );
        process.env.SELECTED_PM = packageManager;
      }, 90000);
    }

    // skipping due to packageManagerCommand for createWorkspace not using yarn create nx-workspace
    if (packageManager === 'yarn') {
      xit('should use yarn when invoked with yarn create', () => {
        setupProject('yarn');
        checkFilesExist(packageManagerLockFile['yarn']);
        checkFilesDoNotExist(
          packageManagerLockFile['pnpm'],
          packageManagerLockFile['npm'],
          packageManagerLockFile['bun']
        );
        process.env.SELECTED_PM = packageManager;
      }, 90000);
    }
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

describe('create-nx-workspace yarn berry', () => {
  const tmpDir = `${e2eCwd}/${uniq('yarn-berry')}`;
  let wsName: string;
  let yarnVersion: string;

  beforeAll(() => {
    mkdirSync(tmpDir, { recursive: true });
    runCommand('corepack prepare yarn@3.6.1 --activate', { cwd: tmpDir });
    runCommand('yarn set version 3.6.1', { cwd: tmpDir });
    yarnVersion = runCommand('yarn --version', { cwd: tmpDir }).trim();
    // previous command creates a package.json file which we don't want
    rmSync(`${tmpDir}/package.json`);
    process.env.YARN_ENABLE_IMMUTABLE_INSTALLS = 'false';
  });

  afterEach(() => cleanupProject({ cwd: `${tmpDir}/${wsName}` }));

  it('should create a workspace with yarn berry', () => {
    wsName = uniq('apps');

    runCreateWorkspace(wsName, {
      preset: 'apps',
      packageManager: 'yarn',
      cwd: tmpDir,
    });

    expect(existsSync(`${tmpDir}/${wsName}/.yarnrc.yml`)).toBeTruthy();
    expect(
      readFileSync(`${tmpDir}/${wsName}/.yarnrc.yml`, { encoding: 'utf-8' })
    ).toMatchInlineSnapshot(`
      "nodeLinker: node-modules

      yarnPath: .yarn/releases/yarn-${yarnVersion}.cjs
      "
    `);
  });

  it('should create a js workspace with yarn berry', () => {
    wsName = uniq('ts');

    runCreateWorkspace(wsName, {
      preset: 'ts',
      packageManager: 'yarn',
      cwd: tmpDir,
    });

    expect(existsSync(`${tmpDir}/${wsName}/.yarnrc.yml`)).toBeTruthy();
    expect(
      readFileSync(`${tmpDir}/${wsName}/.yarnrc.yml`, { encoding: 'utf-8' })
    ).toMatchInlineSnapshot(`
      "nodeLinker: node-modules

      yarnPath: .yarn/releases/yarn-${yarnVersion}.cjs
      "
    `);
  });
});
