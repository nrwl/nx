import {
  runCLI,
  cleanupProject,
  newProject,
  uniq,
  updateJson,
  runE2ETests,
  directoryExists,
  readJson,
  updateFile,
  removeFile,
  createFile,
} from 'e2e/utils';

describe('@nx/next (legacy)', () => {
  let project: string;
  let appName: string;

  beforeAll(() => {
    project = newProject({
      packages: ['@nx/next'],
    });
    appName = uniq('app');
    runCLI(
      `generate @nx/next:app ${appName} --project-name-and-root-format=as-provided --no-interactive`,
      { env: { NX_ADD_PLUGINS: 'false' } }
    );

    // update package.json to add next as a script
    updateJson(`package.json`, (json) => {
      json.scripts = json.scripts || {};
      json.scripts.next = 'next';
      return json;
    });
  });

  afterAll(() => cleanupProject());

  it('nx.json should contain plugin configuration', () => {
    const nxJson = readJson('nx.json');
    const nextPlugin = nxJson.plugins.find(
      (plugin) => plugin.plugin === '@nx/next/plugin'
    );
    expect(nextPlugin).toBeDefined();
    expect(nextPlugin.options).toBeDefined();
    expect(nextPlugin.options.buildTargetName).toEqual('build');
    expect(nextPlugin.options.startTargetName).toEqual('start');
    expect(nextPlugin.options.devTargetName).toEqual('dev');
  });

  it('should build the app', async () => {
    const result = runCLI(`build ${appName}`);
    // check build output for cached artifacts (e.g. .next directory) are inside the project directory
    directoryExists(`${appName}/.next`);

    expect(result).toContain(
      `Successfully ran target build for project ${appName}`
    );
  }, 200_000);

  it('should build the app with .mjs config file', async () => {
    createFile(
      `${appName}/next.config.mjs`,
      `
      export default {
        reactStrictMode: true,
      };
      `
    );

    removeFile(`${appName}/next.config.js`);

    const result = runCLI(`build ${appName}`);
    expect(result).toContain(
      `Successfully ran target build for project ${appName}`
    );
  }, 200_000);

  it('should serve the app', async () => {
    // update cypress config to serve on a different port to avoid port conflicts.
    updateFile(`${appName}-e2e/cypress.config.ts`, (_) => {
      return `
      import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

      import { defineConfig } from 'cypress';

      export default defineConfig({
        e2e: {
          ...nxE2EPreset(__filename, {
            cypressDir: 'src',
            webServerCommands: { default: 'nx run ${appName}:start --port=4000' },
            webServerConfig: { timeout: 20_000 },
          }),
          baseUrl: 'http://localhost:4000',
        },
      });

      `;
    });
    if (runE2ETests()) {
      const e2eResult = runCLI(`run ${appName}-e2e:e2e --verbose`);

      expect(e2eResult).toContain('All specs passed!');
    }
  }, 500_000);
});
