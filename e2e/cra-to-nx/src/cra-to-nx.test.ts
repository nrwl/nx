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
} from '@nrwl/e2e/utils';
import { createReactApp } from './utils';

const pmc = getPackageManagerCommand({
  packageManager: getSelectedPackageManager(),
});

describe('nx init (for CRA)', () => {
  it('should convert to an integrated workspace with craco (webpack)', () => {
    const appName = 'my-app';
    createReactApp(appName);

    const craToNxOutput = runCommand(
      `${
        pmc.runUninstalledPackage
      } nx@${getPublishedVersion()} init --nxCloud=false --integrated --vite=false`
    );

    expect(craToNxOutput).toContain('🎉 Done!');

    const packageJson = readJson('package.json');
    expect(packageJson.devDependencies['@nrwl/jest']).toBeDefined();
    expect(packageJson.devDependencies['@nrwl/vite']).toBeUndefined();
    expect(packageJson.devDependencies['@nrwl/webpack']).toBeDefined();

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
    expect(packageJson.devDependencies['@nrwl/jest']).toBeUndefined();
    expect(packageJson.devDependencies['@nrwl/vite']).toBeDefined();
    expect(packageJson.devDependencies['@nrwl/webpack']).toBeUndefined();

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
    expect(packageJson.devDependencies['@nrwl/jest']).toBeUndefined();

    const viteConfig = readFile(`vite.config.js`);
    expect(viteConfig).toContain('port: 4200'); // default port

    runCLI(`build ${appName}`);
    checkFilesExist(`dist/${appName}/index.html`);

    const unitTestsOutput = runCLI(`test ${appName}`);
    expect(unitTestsOutput).toContain('Successfully ran target test');
  });
});
