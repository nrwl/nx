import {
  checkFilesExist,
  getPackageManagerCommand,
  getPublishedVersion,
  getSelectedPackageManager,
  readJson,
  runCLI,
  runCommand,
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

    runCLI(`build ${appName}`);
    checkFilesExist(`dist/apps/${appName}/index.html`);
  });
});
