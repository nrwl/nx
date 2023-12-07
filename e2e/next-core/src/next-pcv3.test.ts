import {
  runCLI,
  cleanupProject,
  newProject,
  uniq,
  updateJson,
  runE2ETests,
  directoryExists,
  readJson,
} from 'e2e/utils';

describe('@nx/next/plugin', () => {
  let project: string;
  let appName: string;

  beforeAll(() => {
    project = newProject();
    appName = uniq('app');
    runCLI(
      `generate @nx/next:app ${appName} --project-name-and-root-format=as-provided --no-interactive`,
      { env: { NX_PCV3: 'true' } }
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
    // check build output for PCV3 artifacts (e.g. .next directory) are inside the project directory
    directoryExists(`${appName}/.next`);

    expect(result).toContain(
      `Successfully ran target build for project ${appName}`
    );
  }, 200_000);

  it('should serve the app', async () => {
    if (runE2ETests()) {
      const e2eResult = runCLI(`run ${appName}-e2e:e2e --verbose`);

      expect(e2eResult).toContain('All specs passed!');
    }
  }, 500_000);
});
