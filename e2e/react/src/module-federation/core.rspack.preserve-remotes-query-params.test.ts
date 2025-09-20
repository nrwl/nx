import {
  cleanupProject,
  newProject,
  readJson,
  runCLI,
  updateFile,
  uniq,
} from '@nx/e2e-utils';

describe('React Rspack Module Federation - preserve remotes query params', () => {
  beforeAll(() => {
    newProject({ packages: ['@nx/react'] });
  });

  afterAll(() => cleanupProject());

  it('should preserve remotes with query params in the path', async () => {
    const shell = uniq('shell');
    const remote1 = uniq('remote1');

    runCLI(
      `generate @nx/react:host apps/${shell} --name=${shell} --remotes=${remote1} --bundler=rspack --e2eTestRunner=none --style=css --no-interactive --skipFormat`
    );

    updateFile(`apps/${shell}/module-federation.config.ts`, (content) =>
      content.replace(
        `"${remote1}"`,
        `['${remote1}', 'http://localhost:4201/remoteEntry.js?param=value']`
      )
    );

    runCLI(`run ${shell}:build:production`);

    const manifestJson = readJson(`dist/apps/${shell}/mf-manifest.json`);
    const remoteEntry = manifestJson.remotes[0];

    expect(remoteEntry).toBeDefined();
    expect(remoteEntry.entry).toContain(
      'http://localhost:4201/remoteEntry.js?param=value'
    );

    updateFile(`apps/${shell}/module-federation.config.ts`, (content) =>
      content.replace(
        'http://localhost:4201/remoteEntry.js?param=value',
        'http://localhost:4201?param=newValue'
      )
    );

    runCLI(`run ${shell}:build:production`);

    const manifestJsonUpdated = readJson(`dist/apps/${shell}/mf-manifest.json`);
    const remoteEntryUpdated = manifestJsonUpdated.remotes[0];

    expect(remoteEntryUpdated).toBeDefined();
    expect(remoteEntryUpdated.entry).toContain(
      'http://localhost:4201/remoteEntry.js?param=newValue'
    );
  });
});
