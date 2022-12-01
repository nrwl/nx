import {
  checkFilesExist,
  getPackageManagerCommand,
  getPublishedVersion,
  getSelectedPackageManager,
  readFile,
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

    runCLI(`build ${appName}`);
    checkFilesExist(`dist/apps/${appName}/index.html`);
  });

  it('should convert to an integrated workspace with Vite', () => {
    const appName = 'my-app';
    createReactApp(appName);

    const craToNxOutput = runCommand(
      `${
        pmc.runUninstalledPackage
      } nx@${getPublishedVersion()} init --nxCloud=false --integrated`
    );

    expect(craToNxOutput).toContain('🎉 Done!');

    const viteConfig = readFile(`apps/${appName}/vite.config.js`);
    expect(viteConfig).toContain('port: 4200'); // default port

    runCLI(`build ${appName}`);
    checkFilesExist(`dist/apps/${appName}/index.html`);

    const unitTestsOutput = runCLI(`test ${appName}`);
    expect(unitTestsOutput).toContain('Successfully ran target test');
  });

  it('should convert to an integrated workspace with Vite with custom port', () => {
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
  });

  it('should convert to a nested workspace with craco (webpack)', () => {
    const appName = 'my-app';
    createReactApp(appName);

    const craToNxOutput = runCommand(
      `${
        pmc.runUninstalledPackage
      } nx@${getPublishedVersion()} init --nxCloud=false --vite=false`
    );

    expect(craToNxOutput).toContain('🎉 Done!');

    runCLI(`build ${appName}`);
    checkFilesExist(`dist/${appName}/index.html`);
  });

  it('should convert to an nested workspace with Vite', () => {
    const appName = 'my-app';
    createReactApp(appName);

    const craToNxOutput = runCommand(
      `${
        pmc.runUninstalledPackage
      } nx@${getPublishedVersion()} init --nxCloud=false --vite`
    );

    expect(craToNxOutput).toContain('🎉 Done!');

    const viteConfig = readFile(`vite.config.js`);
    expect(viteConfig).toContain('port: 4200'); // default port

    runCLI(`build ${appName}`);
    checkFilesExist(`dist/${appName}/index.html`);

    const unitTestsOutput = runCLI(`test ${appName}`);
    expect(unitTestsOutput).toContain('Successfully ran target test');
  });
});
