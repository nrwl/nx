import {
  checkFilesDoNotExist,
  checkFilesExist,
  e2eCwd,
  expectNoAngularDevkit,
  expectNoTsJestInJestConfig,
  getPackageManagerCommand,
  getSelectedPackageManager,
  packageManagerLockFile,
  readJson,
  runCLI,
  runCreateWorkspace,
  uniq,
  updateFile,
  updateJson,
} from '@nrwl/e2e/utils';
import { existsSync, mkdirSync } from 'fs-extra';
import { execSync } from 'child_process';

describe('create-nx-workspace', () => {
  const packageManager = getSelectedPackageManager() || 'pnpm';

  it('should be able to create an empty workspace built for apps', () => {
    const wsName = uniq('apps');
    runCreateWorkspace(wsName, {
      preset: 'empty',
      packageManager,
    });

    checkFilesExist(
      'workspace.json',
      'package.json',
      packageManagerLockFile[packageManager],
      'apps/.gitkeep',
      'libs/.gitkeep'
    );
    const foreignLockFiles = Object.keys(packageManagerLockFile)
      .filter((pm) => pm !== packageManager)
      .map((pm) => packageManagerLockFile[pm]);

    checkFilesDoNotExist(...foreignLockFiles);

    expectNoAngularDevkit();
  });

  it('should be able to create an empty workspace with core capabilities', () => {
    const wsName = uniq('core');
    runCreateWorkspace(wsName, {
      preset: 'npm',
      packageManager,
    });

    expectNoAngularDevkit();

    const parent = uniq('parent');
    const child = uniq('child');
    runCLI(`generate npm-package ${parent}`);
    runCLI(`generate npm-package ${child}`);

    updateJson(`packages/${parent}/package.json`, (json) => {
      json.dependencies = {
        [`@${wsName}/${child}`]: '*',
      };
      return json;
    });
    updateFile(
      `packages/${parent}/src/index.js`,
      `require('@${wsName}/${child}');`
    );

    runCLI(`test ${parent}`);
    runCLI(`test ${child}`);
  });

  it('should be able to create an empty workspace with ts/js capabilities', () => {
    const wsName = uniq('ts');
    runCreateWorkspace(wsName, {
      preset: 'npm',
      packageManager,
    });

    expectNoAngularDevkit();
  });

  it('should be able to create an angular workspace', () => {
    const wsName = uniq('angular');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'angular',
      style: 'css',
      appName,
      packageManager,
    });
  });

  it('should fail correctly when preset errors', () => {
    // Using Angular Preset as the example here to test
    // It will error when npmScope is of form `<char>-<num>-<char>`
    // Due to a validation error Angular will throw.
    const wsName = uniq('angular-1-test');
    const appName = uniq('app');
    try {
      runCreateWorkspace(wsName, {
        preset: 'angular',
        style: 'css',
        appName,
        packageManager,
      });
    } catch (e) {
      expect(e).toBeTruthy();
    }
  });

  it('should be able to create an react workspace', () => {
    const wsName = uniq('react');
    const appName = uniq('app');

    runCreateWorkspace(wsName, {
      preset: 'react',
      style: 'css',
      appName,
      packageManager,
    });

    expectNoAngularDevkit();
    expectNoTsJestInJestConfig(appName);
  });

  it('should be able to create an next workspace', () => {
    const wsName = uniq('next');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'next',
      style: 'css',
      appName,
      packageManager,
    });

    expectNoAngularDevkit();
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
  });

  it('should be able to create an angular + nest workspace', () => {
    const wsName = uniq('angular-nest');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'angular-nest',
      style: 'css',
      appName,
      packageManager,
    });
  });

  it('should be able to create an react + express workspace', () => {
    const wsName = uniq('react-express');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'react-express',
      style: 'css',
      appName,
      packageManager,
    });

    expectNoAngularDevkit();
    expectNoTsJestInJestConfig(appName);
  });

  it('should be able to create an express workspace', () => {
    const wsName = uniq('express');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'express',
      style: 'css',
      appName,
      packageManager,
    });

    expectNoAngularDevkit();
  });

  it('should be able to create a workspace with a custom base branch and HEAD', () => {
    const wsName = uniq('branch');
    runCreateWorkspace(wsName, {
      preset: 'empty',
      base: 'main',
      packageManager,
    });
  });

  it('should be able to create a workspace with custom commit information', () => {
    const wsName = uniq('branch');
    runCreateWorkspace(wsName, {
      preset: 'empty',
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
      appName,
      packageManager,
    });
  });

  it('should handle spaces in workspace path', () => {
    const wsName = uniq('empty');

    const tmpDir = `${e2eCwd}/${uniq('with space')}`;

    mkdirSync(tmpDir, { recursive: true });

    const createCommand = getPackageManagerCommand({
      packageManager,
    }).createWorkspace;
    const fullCommand = `${createCommand} ${wsName} --cli=nx --preset=apps --no-nxCloud --no-interactive`;
    execSync(fullCommand, {
      cwd: tmpDir,
      stdio: [0, 1, 2],
      env: process.env,
    });

    expect(existsSync(`${tmpDir}/${wsName}/package.json`)).toBeTruthy();
  });

  it('should respect package manager preference', () => {
    const wsName = uniq('pm');
    const appName = uniq('app');

    process.env.YARN_REGISTRY = `http://localhost:4872`;
    process.env.SELECTED_PM = 'npm';

    runCreateWorkspace(wsName, {
      preset: 'react',
      style: 'css',
      appName,
      packageManager: 'npm',
    });

    checkFilesDoNotExist('yarn.lock');
    checkFilesExist('package-lock.json');
    process.env.SELECTED_PM = packageManager;
  });

  it('should store package manager preference for angular cli', () => {
    const wsName = uniq('pm');
    const appName = uniq('app');

    process.env.YARN_REGISTRY = `http://localhost:4872`;
    process.env.SELECTED_PM = 'npm';

    runCreateWorkspace(wsName, {
      preset: 'angular',
      appName,
      style: 'css',
      packageManager: 'npm',
      cli: 'angular',
    });

    const nxJson = readJson('nx.json');
    expect(nxJson.cli.packageManager).toEqual('npm');
    checkFilesDoNotExist('yarn.lock');
    checkFilesExist('package-lock.json');
    process.env.SELECTED_PM = packageManager;
  });

  it('should return error when ci workflow is selected but no cloud is set up', () => {
    const wsName = uniq('github');
    const create = runCreateWorkspace(wsName, {
      preset: 'core',
      packageManager,
      ci: 'circleci',
    });
    checkFilesExist('package.json');
    checkFilesDoNotExist('.circleci/config.yml');
  });

  describe('Use detected package manager', () => {
    function setupProject(envPm: 'npm' | 'yarn' | 'pnpm') {
      process.env.SELECTED_PM = envPm;
      runCreateWorkspace(uniq('pm'), {
        preset: 'empty',
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
          packageManagerLockFile['pnpm']
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
          packageManagerLockFile['npm']
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
          packageManagerLockFile['npm']
        );
        process.env.SELECTED_PM = packageManager;
      }, 90000);
    }
  });
});
