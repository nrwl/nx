import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  e2eCwd,
  expectCodeIsFormatted,
  expectNoAngularDevkit,
  getSelectedPackageManager,
  packageManagerLockFile,
  readJson,
  runCommand,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e-utils';
import { readFileSync } from 'fs';

describe('create-nx-workspace misc', () => {
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

  it('should be able to create react-native workspace', () => {
    const wsName = uniq('react-native');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'react-native',
      appName,
      packageManager: 'npm',
      e2eTestRunner: 'none',
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
      e2eTestRunner: 'none',
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
});

describe('Use detected package manager', () => {
  const packageManager = getSelectedPackageManager() || 'pnpm';

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

describe('create-nx-workspace parent folder', () => {
  const tmpDir = `${e2eCwd}/${uniq('with space')}`;
  const wsName = uniq('parent');
  const packageManager = getSelectedPackageManager() || 'pnpm';

  afterEach(() => cleanupProject({ cwd: `${tmpDir}/${wsName}` }));

  it('should handle spaces in workspace path', () => {
    // lazy import to avoid requiring fs-extra globally
    const { existsSync, mkdirSync } = require('fs-extra');
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
    const { mkdirSync, rmSync } = require('fs-extra');
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

    const result = readFileSync(`${tmpDir}/${wsName}/.yarnrc.yml`, {
      encoding: 'utf-8',
    });
    expect(result).toContain('nodeLinker: node-modules');
    expect(result).toContain(`yarn-${yarnVersion}`);
  });

  it('should create a js workspace with yarn berry', () => {
    wsName = uniq('ts');

    runCreateWorkspace(wsName, {
      preset: 'ts',
      packageManager: 'yarn',
      cwd: tmpDir,
    });

    const result = readFileSync(`${tmpDir}/${wsName}/.yarnrc.yml`, {
      encoding: 'utf-8',
    });
    expect(result).toContain('nodeLinker: node-modules');
    expect(result).toContain(`yarn-${yarnVersion}`);
  });
});


