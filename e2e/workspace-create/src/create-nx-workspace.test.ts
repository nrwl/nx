import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  e2eCwd,
  expectNoAngularDevkit,
  expectNoTsJestInJestConfig,
  getSelectedPackageManager,
  packageInstall,
  packageManagerLockFile,
  runCLI,
  runCreateWorkspace,
  uniq,
} from '@nrwl/e2e/utils';
import { existsSync, mkdirSync } from 'fs-extra';

describe('create-nx-workspace', () => {
  const packageManager = getSelectedPackageManager() || 'pnpm';

  afterEach(() => cleanupProject());

  it('should create a workspace with a single angular app at the root', () => {
    const wsName = uniq('angular');

    runCreateWorkspace(wsName, {
      preset: 'angular-standalone',
      appName: wsName,
      style: 'css',
      packageManager,
    });

    checkFilesExist('package.json');
    checkFilesExist('project.json');
  });

  it('should create a workspace with a single react app at the root', () => {
    const wsName = uniq('react');

    runCreateWorkspace(wsName, {
      preset: 'react-standalone',
      appName: wsName,
      style: 'css',
      packageManager,
    });

    checkFilesExist('package.json');
    checkFilesExist('project.json');
  });

  it('should be able to create an empty workspace built for apps', () => {
    const wsName = uniq('apps');
    runCreateWorkspace(wsName, {
      preset: 'empty',
      packageManager,
    });

    checkFilesExist(
      'package.json',
      packageManagerLockFile[packageManager],
      'apps/.gitkeep',
      'libs/.gitkeep'
    );
    const foreignLockFiles = Object.keys(packageManagerLockFile)
      .filter((pm) => pm !== packageManager)
      .map((pm) => packageManagerLockFile[pm]);

    checkFilesDoNotExist(...foreignLockFiles, 'workspace.json');

    expectNoAngularDevkit();
  });

  it('should be able to create an empty workspace with npm capabilities', () => {
    const wsName = uniq('npm');
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
      preset: 'angular-monorepo',
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
        preset: 'angular-monorepo',
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
      preset: 'react-monorepo',
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

  it('should be able to create react-native workspace', () => {
    const wsName = uniq('react-native');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'react-native',
      appName,
      packageManager: 'npm',
    });

    expectNoAngularDevkit();
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

  it('should respect package manager preference', () => {
    const wsName = uniq('pm');
    const appName = uniq('app');

    process.env.YARN_REGISTRY = `http://localhost:4872`;
    process.env.SELECTED_PM = 'npm';

    runCreateWorkspace(wsName, {
      preset: 'react-monorepo',
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
      preset: 'angular-monorepo',
      appName,
      style: 'css',
      packageManager: 'npm',
      cli: 'angular',
    });

    checkFilesDoNotExist('yarn.lock');
    checkFilesExist('package-lock.json');
    process.env.SELECTED_PM = packageManager;
  });

  it('should return error when ci workflow is selected but no cloud is set up', () => {
    const wsName = uniq('github');
    const create = runCreateWorkspace(wsName, {
      preset: 'npm',
      packageManager,
      ci: 'circleci',
    });
    checkFilesExist('package.json');
    checkFilesDoNotExist('.circleci/config.yml');
  });

  describe('Start with package-based repo', () => {
    const wsName = uniq('npm');

    beforeEach(() => {
      runCreateWorkspace(wsName, {
        preset: 'npm',
        packageManager,
      });
    });

    it('should not generate tsconfig.base.json', () => {
      checkFilesDoNotExist('tsconfig.base.json');
    });

    it('should add js library', () => {
      const libName = uniq('lib');
      packageInstall('@nrwl/js', wsName);

      expect(() =>
        runCLI(`generate @nrwl/js:library ${libName} --no-interactive`)
      ).not.toThrowError();
      checkFilesExist('tsconfig.base.json');
    });

    it('should add web library', () => {
      const libName = uniq('lib');
      packageInstall('@nrwl/web', wsName);

      expect(() =>
        runCLI(`generate @nrwl/web:library ${libName} --no-interactive`)
      ).not.toThrowError();
      checkFilesExist('tsconfig.base.json');
    });

    it('should add angular application and library', () => {
      const appName = uniq('my-app');
      const libName = uniq('lib');
      packageInstall('@nrwl/angular', wsName);

      expect(() => {
        runCLI(`generate @nrwl/angular:app ${appName} --no-interactive`);
        runCLI(`generate @nrwl/angular:lib ${libName} --no-interactive`);
      }).not.toThrowError();
      checkFilesExist('tsconfig.base.json');
    });

    it('should add react application and library', () => {
      const appName = uniq('my-app');
      const libName = uniq('lib');
      packageInstall('@nrwl/react', wsName);

      expect(() => {
        runCLI(`generate @nrwl/react:app ${appName} --no-interactive`);
        runCLI(`generate @nrwl/react:lib ${libName} --no-interactive`);
      }).not.toThrowError();
      checkFilesExist('tsconfig.base.json');
    });

    it('should add react-native application and library', () => {
      const appName = uniq('my-app');
      const libName = uniq('lib');
      packageInstall('@nrwl/react-native', wsName);

      expect(() => {
        runCLI(`generate @nrwl/react-native:app ${appName} --no-interactive`);
        runCLI(`generate @nrwl/react-native:lib ${libName} --no-interactive`);
      }).not.toThrowError();
      checkFilesExist('tsconfig.base.json');
    });

    it('should add expo application and library', () => {
      const appName = uniq('my-app');
      const libName = uniq('lib');
      packageInstall('@nrwl/expo', wsName);

      expect(() => {
        runCLI(`generate @nrwl/expo:app ${appName} --no-interactive`);
        runCLI(`generate @nrwl/expo:lib ${libName} --no-interactive`);
      }).not.toThrowError();
      checkFilesExist('tsconfig.base.json');
    });
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

describe('create-nx-workspace custom parent folder', () => {
  const tmpDir = `${e2eCwd}/${uniq('with space')}`;
  const wsName = uniq('empty');
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
