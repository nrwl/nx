import { readJson, runCLI, updateFile } from '@nx/e2e-utils';

import {
  generatePlaywrightHost,
  regenerateMFManifest,
  setupReactModuleFederationSuite,
} from './core.setup';

describe('React Module Federation - query params', () => {
  setupReactModuleFederationSuite();

  it('should preserve remotes with query params in the path', () => {
    const shell = 'shell';
    const remote1 = 'remote1';

    generatePlaywrightHost(shell, [remote1]);

    updateFile(`apps/${shell}/webpack.config.prod.ts`, (content) =>
      content.replace(
        `'http://localhost:4201/'`,
        `'http://localhost:4201/remoteEntry.js?param=value'`
      )
    );

    runCLI(`run ${shell}:build:production`);

    const manifestJson = readJson(`dist/apps/${shell}/mf-manifest.json`);
    const remoteEntry = manifestJson.remotes[0];

    expect(remoteEntry).toBeDefined();
    expect(remoteEntry.entry).toContain(
      'http://localhost:4201/remoteEntry.js?param=value'
    );
    expect(manifestJson.remotes).toMatchInlineSnapshot(`
        [
          {
            "alias": "remote1",
            "entry": "http://localhost:4201/remoteEntry.js?param=value",
            "federationContainerName": "remote1",
            "moduleName": "Module",
          },
        ]
      `);

    regenerateMFManifest(shell, 'http://localhost:4201?param=newValue');

    runCLI(`run ${shell}:build:production`);

    const manifestJsonUpdated = readJson(
      `dist/apps/${shell}/mf-manifest.json`
    );
    const remoteEntryUpdated = manifestJsonUpdated.remotes[0];

    expect(remoteEntryUpdated).toBeDefined();
    expect(remoteEntryUpdated.entry).toContain(
      'http://localhost:4201/remoteEntry.js?param=newValue'
    );
  });
});

