import {
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

describe('cra-to-nx', () => {
  it('should convert to an integrated workspace with craco (webpack)', () => {
    const appName = 'my-app';
    createReactApp(appName);

    const craToNxOutput = runCommand(
      `${
        pmc.runUninstalledPackage
      } cra-to-nx@${getPublishedVersion()} --nxCloud=false`
    );

    expect(craToNxOutput).toContain('🎉 Done!');

    runCLI(`build ${appName}`);
    checkFilesExist(
      `dist/apps/${appName}/index.html`,
      `dist/apps/${appName}/asset-manifest.json`
    );
    const manifest = readJson(`dist/apps/${appName}/asset-manifest.json`);
    checkFilesExist(
      ...manifest['entrypoints'].map((f) => `dist/apps/${appName}/${f}`)
    );
  });

  it('should convert to an integrated workspace with Vite', () => {
    const appName = 'my-app';
    createReactApp(appName);

    const craToNxOutput = runCommand(
      `${
        pmc.runUninstalledPackage
      } cra-to-nx@${getPublishedVersion()} --nxCloud=false --vite`
    );

    expect(craToNxOutput).toContain('🎉 Done!');

    const viteConfig = readFile(`apps/${appName}/vite.config.js`);
    expect(viteConfig).toContain('port: 4200'); // default port

    runCLI(`build ${appName}`);
    checkFilesExist(`dist/apps/${appName}/index.html`);
  });

  it('should convert to an integrated workspace with Vite with custom port', () => {
    const appName = 'my-app';
    createReactApp(appName);
    updateFile(`.env`, `NOT_THE_PORT=8000\nPORT=3000\nSOMETHING_ELSE=whatever`);

    runCommand(
      `${
        pmc.runUninstalledPackage
      } cra-to-nx@${getPublishedVersion()} --nxCloud=false --vite --force`
    );

    const viteConfig = readFile(`apps/${appName}/vite.config.js`);
    expect(viteConfig).toContain('port: 3000');
  });
});
