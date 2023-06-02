import {
  checkFilesDoNotExist,
  checkFilesExist,
  getPackageManagerCommand,
  getPublishedVersion,
  getSelectedPackageManager,
  readFile,
  readJson,
  runCLI,
  runCommand,
  updateFile,
} from '@nx/e2e/utils';
import { copySync, renameSync } from 'fs-extra';
import { sync as globSync } from 'glob';
import { join } from 'path';
import {
  createNonNxProjectDirectory,
  tmpProjPath,
  updateJson,
} from '../../utils';

const pmc = getPackageManagerCommand({
  packageManager: getSelectedPackageManager(),
});

describe('nx init (for React)', () => {
  // TODO(@jaysoo): Please investigate why this test is failing
  xit('should convert to an integrated workspace with craco (webpack)', () => {
    const appName = 'my-app';
    createReactApp(appName);

    const craToNxOutput = runCommand(
      `${
        pmc.runUninstalledPackage
      } nx@${getPublishedVersion()} init --nxCloud=false --integrated --vite=false`
    );

    expect(craToNxOutput).toContain('🎉 Done!');

    const packageJson = readJson('package.json');
    expect(packageJson.devDependencies['@nx/jest']).toBeDefined();
    expect(packageJson.devDependencies['@nx/vite']).toBeUndefined();
    expect(packageJson.devDependencies['@nx/webpack']).toBeDefined();
    expect(packageJson.dependencies['redux']).toBeDefined();
    expect(packageJson.name).toEqual(appName);

    runCLI(`build ${appName}`, {
      env: {
        // since craco 7.1.0 the NODE_ENV is used, since the tests set it
        // to "test" is causes an issue with React Refresh Babel
        NODE_ENV: undefined,
      },
    });
    checkFilesExist(`dist/apps/${appName}/index.html`);
  });

  it('should convert to an integrated workspace with Vite', () => {
    // TODO investigate why this is broken
    const originalPM = process.env.SELECTED_PM;
    process.env.SELECTED_PM = originalPM === 'pnpm' ? 'yarn' : originalPM;

    const appName = 'my-app';
    createReactApp(appName);

    const craToNxOutput = runCommand(
      `${
        pmc.runUninstalledPackage
      } nx@${getPublishedVersion()} init --nxCloud=false --integrated`
    );

    expect(craToNxOutput).toContain('🎉 Done!');

    const packageJson = readJson('package.json');
    expect(packageJson.devDependencies['@nx/jest']).toBeUndefined();
    expect(packageJson.devDependencies['@nx/vite']).toBeDefined();
    expect(packageJson.devDependencies['@nx/webpack']).toBeUndefined();

    const viteConfig = readFile(`apps/${appName}/vite.config.js`);
    expect(viteConfig).toContain('port: 4200'); // default port

    runCLI(`build ${appName}`);
    checkFilesExist(`dist/apps/${appName}/index.html`);

    const unitTestsOutput = runCLI(`test ${appName}`);
    expect(unitTestsOutput).toContain('Successfully ran target test');
    process.env.SELECTED_PM = originalPM;
  });

  it('should convert to an integrated workspace with Vite with custom port', () => {
    // TODO investigate why this is broken
    const originalPM = process.env.SELECTED_PM;
    process.env.SELECTED_PM = originalPM === 'pnpm' ? 'yarn' : originalPM;
    const appName = 'my-app';
    createReactApp(appName);
    updateFile(`.env`, `NOT_THE_PORT=8000\nPORT=3000\nSOMETHING_ELSE=whatever`);

    runCommand(
      `${
        pmc.runUninstalledPackage
      } nx@${getPublishedVersion()} init --nxCloud=false --force --integrated`
    );

    const viteConfig = readFile(`apps/${appName}/vite.config.js`);
    expect(viteConfig).toContain('port: 3000');

    const unitTestsOutput = runCLI(`test ${appName}`);
    expect(unitTestsOutput).toContain('Successfully ran target test');
    process.env.SELECTED_PM = originalPM;
  });

  it('should convert to a standalone workspace with craco (webpack)', () => {
    const appName = 'my-app';
    createReactApp(appName);

    const craToNxOutput = runCommand(
      `${
        pmc.runUninstalledPackage
      } nx@${getPublishedVersion()} init --nxCloud=false --vite=false`
    );

    expect(craToNxOutput).toContain('🎉 Done!');

    runCLI(`build ${appName}`, {
      env: {
        // since craco 7.1.0 the NODE_ENV is used, since the tests set it
        // to "test" is causes an issue with React Refresh Babel
        NODE_ENV: undefined,
      },
    });
    checkFilesExist(`dist/${appName}/index.html`);
  });

  it('should convert to an standalone workspace with Vite', () => {
    const appName = 'my-app';
    createReactApp(appName);

    const craToNxOutput = runCommand(
      `${
        pmc.runUninstalledPackage
      } nx@${getPublishedVersion()} init --nxCloud=false --vite`
    );

    expect(craToNxOutput).toContain('🎉 Done!');

    checkFilesDoNotExist(
      'libs/.gitkeep',
      'tools/tsconfig.tools.json',
      'babel.config.json',
      'jest.preset.js',
      'jest.config.ts'
    );

    const packageJson = readJson('package.json');
    expect(packageJson.devDependencies['@nx/jest']).toBeUndefined();
    expect(packageJson.dependencies['redux']).toBeDefined();
    expect(packageJson.name).toEqual(appName);

    const viteConfig = readFile(`vite.config.js`);
    expect(viteConfig).toContain('port: 4200'); // default port

    runCLI(`build ${appName}`);
    checkFilesExist(`dist/${appName}/index.html`);

    const unitTestsOutput = runCLI(`test ${appName}`);
    expect(unitTestsOutput).toContain('Successfully ran target test');
  });
});

function createReactApp(appName: string) {
  const pmc = getPackageManagerCommand({
    packageManager: getSelectedPackageManager(),
  });

  createNonNxProjectDirectory();
  const projPath = tmpProjPath();
  copySync(join(__dirname, 'files/cra'), projPath);
  const filesToRename = globSync(join(projPath, '**/*.txt'));
  filesToRename.forEach((f) => {
    renameSync(f, f.split('.txt')[0]);
  });
  updateFile('.gitignore', 'node_modules');
  updateJson('package.json', (_) => ({
    name: appName,
    version: '0.1.0',
    private: true,
    dependencies: {
      '@testing-library/jest-dom': '5.16.5',
      '@testing-library/react': '13.4.0',
      '@testing-library/user-event': '13.5.0',
      react: '^18.2.0',
      'react-dom': '^18.2.0',
      'react-scripts': '5.0.1',
      'web-vitals': '2.1.4',
      redux: '^3.6.0',
    },
    scripts: {
      start: 'react-scripts start',
      build: 'react-scripts build',
      test: 'react-scripts test',
      eject: 'react-scripts eject',
    },
    eslintConfig: {
      extends: ['react-app', 'react-app/jest'],
    },
    browserslist: {
      production: ['>0.2%', 'not dead', 'not op_mini all'],
      development: [
        'last 1 chrome version',
        'last 1 firefox version',
        'last 1 safari version',
      ],
    },
  }));
  runCommand(pmc.install);
  runCommand('git init');
  runCommand('git add .');
  runCommand('git commit -m "Init"');
}
