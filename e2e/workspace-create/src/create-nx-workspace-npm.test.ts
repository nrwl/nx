import {
  checkFilesExist,
  cleanupProject,
  getSelectedPackageManager,
  packageInstall,
  readJson,
  runCLI,
  runCommand,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e/utils';

describe('create-nx-workspace --preset=npm', () => {
  const wsName = uniq('npm');

  let orginalGlobCache;

  beforeAll(() => {
    orginalGlobCache = process.env.NX_PROJECT_GLOB_CACHE;
    // glob cache is causing previous projects to show in Workspace for maxWorkers overrides
    // which fails due to files no longer being available
    process.env.NX_PROJECT_GLOB_CACHE = 'false';

    runCreateWorkspace(wsName, {
      preset: 'npm',
      packageManager: getSelectedPackageManager(),
    });
  });

  afterEach(() => {
    // cleanup previous projects
    runCommand(`rm -rf packages/** tsconfig.base.json`);
  });

  afterAll(() => {
    process.env.NX_PROJECT_GLOB_CACHE = orginalGlobCache;
    cleanupProject({ skipReset: true });
  });

  it('should setup package-based workspace', () => {
    const packageJson = readJson('package.json');
    expect(packageJson.dependencies).toEqual({});

    if (getSelectedPackageManager() === 'pnpm') {
      checkFilesExist('pnpm-workspace.yaml');
    } else {
      expect(packageJson.workspaces).toEqual(['packages/*']);
    }
  });

  it('should add angular application', () => {
    packageInstall('@nx/angular', wsName);
    const appName = uniq('my-app');

    expect(() => {
      runCLI(`generate @nx/angular:app packages/${appName} --no-interactive`);
    }).not.toThrowError();
    checkFilesExist('tsconfig.base.json');
  }, 1_000_000);

  it('should add angular library', () => {
    packageInstall('@nx/angular', wsName);
    const libName = uniq('lib');

    expect(() => {
      runCLI(`generate @nx/angular:lib packages/${libName} --no-interactive`);
    }).not.toThrowError();
    checkFilesExist('tsconfig.base.json');
    const tsconfig = readJson(`tsconfig.base.json`);
    expect(tsconfig.compilerOptions.paths).toEqual({
      [`@${wsName}/${libName}`]: [`packages/${libName}/src/index.ts`],
    });
  }, 1_000_000);

  it('should add js library', () => {
    packageInstall('@nx/js', wsName);

    const libName = uniq('lib');

    expect(() =>
      runCLI(`generate @nx/js:library packages/${libName} --no-interactive`)
    ).not.toThrowError();
    checkFilesExist('tsconfig.base.json');
    const tsconfig = readJson(`tsconfig.base.json`);
    expect(tsconfig.compilerOptions.paths).toEqual({
      [`@${wsName}/${libName}`]: [`packages/${libName}/src/index.ts`],
    });
  });

  it('should add web application', () => {
    packageInstall('@nx/web', wsName);

    const appName = uniq('my-app');

    expect(() =>
      runCLI(`generate @nx/web:app packages/${appName} --no-interactive`)
    ).not.toThrowError();
    checkFilesExist('tsconfig.base.json');
  });

  it('should add react application', () => {
    packageInstall('@nx/react', wsName);

    const appName = uniq('my-app');

    expect(() => {
      runCLI(`generate @nx/react:app packages/${appName} --no-interactive`);
    }).not.toThrowError();
    checkFilesExist('tsconfig.base.json');
  });

  it('should add react library', () => {
    packageInstall('@nx/react', wsName);

    const libName = uniq('lib');

    expect(() => {
      runCLI(`generate @nx/react:lib packages/${libName} --no-interactive`);
    }).not.toThrowError();
    checkFilesExist('tsconfig.base.json');
    const tsconfig = readJson(`tsconfig.base.json`);
    expect(tsconfig.compilerOptions.paths).toEqual({
      [`@${wsName}/${libName}`]: [`packages/${libName}/src/index.ts`],
    });
  });

  it('should add next application', () => {
    packageInstall('@nx/next', wsName);

    const appName = uniq('my-app');

    expect(() => {
      runCLI(`generate @nx/next:app packages/${appName} --no-interactive`);
    }).not.toThrowError();
    checkFilesExist('tsconfig.base.json');
  });

  it('should add next library', () => {
    packageInstall('@nx/next', wsName);

    const libName = uniq('lib');

    expect(() => {
      runCLI(`generate @nx/next:lib packages/${libName} --no-interactive`);
    }).not.toThrowError();
    checkFilesExist('tsconfig.base.json');
    const tsconfig = readJson(`tsconfig.base.json`);
    expect(tsconfig.compilerOptions.paths).toEqual({
      [`@${wsName}/${libName}`]: [`packages/${libName}/src/index.ts`],
      [`@${wsName}/${libName}/server`]: [`packages/${libName}/src/server.ts`],
    });
  });

  it('should add react-native application', () => {
    packageInstall('@nx/react-native', wsName);

    const appName = uniq('my-app');

    expect(() => {
      runCLI(
        `generate @nx/react-native:app packages/${appName} --install=false --no-interactive`
      );
    }).not.toThrowError();
    checkFilesExist('tsconfig.base.json');
  });

  it('should add react-native library', () => {
    packageInstall('@nx/react-native', wsName);

    const libName = uniq('lib');

    expect(() => {
      runCLI(
        `generate @nx/react-native:lib packages/${libName} --no-interactive`
      );
    }).not.toThrowError();
    checkFilesExist('tsconfig.base.json');
    const tsconfig = readJson(`tsconfig.base.json`);
    expect(tsconfig.compilerOptions.paths).toEqual({
      [`@${wsName}/${libName}`]: [`packages/${libName}/src/index.ts`],
    });
  });

  it('should add node application', () => {
    packageInstall('@nx/node', wsName);

    const appName = uniq('my-app');

    expect(() => {
      runCLI(`generate @nx/node:app packages/${appName} --no-interactive`);
    }).not.toThrowError();
    checkFilesExist('tsconfig.base.json');
  });

  it('should add node library', () => {
    packageInstall('@nx/node', wsName);

    const libName = uniq('lib');

    expect(() => {
      runCLI(`generate @nx/node:lib packages/${libName} --no-interactive`);
    }).not.toThrowError();
    checkFilesExist('tsconfig.base.json');
    const tsconfig = readJson(`tsconfig.base.json`);
    expect(tsconfig.compilerOptions.paths).toEqual({
      [`@${wsName}/${libName}`]: [`packages/${libName}/src/index.ts`],
    });
  });

  it('should add nest application', () => {
    packageInstall('@nx/nest', wsName);

    const appName = uniq('my-app');

    expect(() => {
      runCLI(`generate @nx/nest:app packages/${appName} --no-interactive`);
    }).not.toThrowError();
    checkFilesExist('tsconfig.base.json');
  });

  it('should add nest library', () => {
    packageInstall('@nx/nest', wsName);

    const libName = uniq('lib');

    expect(() => {
      runCLI(`generate @nx/nest:lib packages/${libName} --no-interactive`);
    }).not.toThrowError();
    checkFilesExist('tsconfig.base.json');
    const tsconfig = readJson(`tsconfig.base.json`);
    expect(tsconfig.compilerOptions.paths).toEqual({
      [`@${wsName}/${libName}`]: [`packages/${libName}/src/index.ts`],
    });
  });

  it('should add express application', () => {
    packageInstall('@nx/express', wsName);

    const appName = uniq('my-app');

    expect(() => {
      runCLI(`generate @nx/express:app packages/${appName} --no-interactive`);
    }).not.toThrowError();
    checkFilesExist('tsconfig.base.json');
  });
});
