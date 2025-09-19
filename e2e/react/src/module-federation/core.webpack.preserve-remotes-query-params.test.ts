import {
  cleanupProject,
  newProject,
  readJson,
  runCLI,
  updateFile,
  uniq,
} from '@nx/e2e-utils';

describe('React Module Federation - Webpack - preserve remotes query params', () => {
  beforeAll(() => {
    newProject({ packages: ['@nx/react', '@nx/webpack'] });
  });

  afterAll(() => cleanupProject());

  it('should preserve remotes with query params in the path', async () => {
    const shell = uniq('shell');
    const remote1 = uniq('remote1');

    runCLI(
      `generate @nx/react:host apps/${shell} --name=${shell} --remotes=${remote1} --bundler=webpack --e2eTestRunner=none --style=css --no-interactive --skipFormat`
    );

    // Update the remote entry to include query params at the end with remoteEntry in path
    updateFile(`apps/${shell}/webpack.config.prod.ts`, (content) =>
      content.replace(
        `'http://localhost:4201/'`,
        `'http://localhost:4201/remoteEntry.js?param=value'`
      )
    );

    runCLI(`run ${shell}:build:production`);

    // Check the artifact in dist for the remote
    const manifestJson = readJson(`dist/apps/${shell}/mf-manifest.json`);
    const remoteEntry = manifestJson.remotes[0];

    expect(remoteEntry).toBeDefined();
    expect(remoteEntry.entry).toContain(
      'http://localhost:4201/remoteEntry.js?param=value'
    );

    // Update the remote entry to include query params at the end without remoteEntry in path
    updateFile(`apps/${shell}/webpack.config.prod.ts`, (content) =>
      content.replace(
        `'http://localhost:4201/remoteEntry.js?param=value'`,
        `'http://localhost:4201?param=newValue'`
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
