import { readJson, uniq, updateFile } from '@nx/e2e-utils';
import { runCLI } from './utils';
import {
  setupCoreRspackTest,
  cleanupCoreRspackTest,
} from './core-rspack-setup';

describe('React Rspack Module Federation - Query Params', () => {
  beforeEach(() => {
    setupCoreRspackTest();
  });

  afterEach(() => cleanupCoreRspackTest());

  it('should preserve remotes with query params in the path', async () => {
    const shell = uniq('shell');
    const remote1 = uniq('remote1');

    runCLI(
      `generate @nx/react:host apps/${shell} --name=${shell} --remotes=${remote1} --bundler=rspack --e2eTestRunner=none --style=css --no-interactive --skipFormat`
    );

    // Update the remote entry to include query params
    updateFile(`apps/${shell}/module-federation.config.ts`, (content) =>
      content.replace(
        `"${remote1}"`,
        `['${remote1}', 'http://localhost:4201/remoteEntry.js?param=value']`
      )
    );

    runCLI(`run ${shell}:build:production`);

    // Check the artifact in dist for the remote
    const manifestJson = readJson(`dist/apps/${shell}/mf-manifest.json`);
    const remoteEntry = manifestJson.remotes[0]; // There should be only one remote

    expect(remoteEntry).toBeDefined();
    expect(remoteEntry.entry).toContain(
      'http://localhost:4201/remoteEntry.js?param=value'
    );
    expect(manifestJson.remotes).toMatchInlineSnapshot(`
        [
          {
            "alias": "${remote1}",
            "entry": "http://localhost:4201/remoteEntry.js?param=value",
            "federationContainerName": "${remote1}",
            "moduleName": "Module",
          },
        ]
      `);

    // Update the remote entry to include new query params without remoteEntry.js
    updateFile(`apps/${shell}/module-federation.config.ts`, (content) =>
      content.replace(
        'http://localhost:4201/remoteEntry.js?param=value',
        'http://localhost:4201?param=newValue'
      )
    );

    runCLI(`run ${shell}:build:production`);

    // Check the artifact in dist for the remote
    const manifestJsonUpdated = readJson(`dist/apps/${shell}/mf-manifest.json`);
    const remoteEntryUpdated = manifestJsonUpdated.remotes[0]; // There should be only one remote

    expect(remoteEntryUpdated).toBeDefined();
    expect(remoteEntryUpdated.entry).toContain(
      'http://localhost:4201/remoteEntry.js?param=newValue'
    );
  });
});
