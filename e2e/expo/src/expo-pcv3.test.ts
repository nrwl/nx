import { ChildProcess } from 'child_process';
import {
  runCLI,
  cleanupProject,
  newProject,
  uniq,
  readJson,
  runCommandUntil,
  killProcessAndPorts,
  checkFilesExist,
} from 'e2e/utils';

describe('@nx/expo/plugin', () => {
  let project: string;
  let appName: string;

  beforeAll(() => {
    project = newProject();
    appName = uniq('app');
    runCLI(
      `generate @nx/expo:app ${appName} --project-name-and-root-format=as-provided --no-interactive`,
      { env: { NX_PCV3: 'true' } }
    );
  });

  afterAll(() => cleanupProject());

  it('nx.json should contain plugin configuration', () => {
    const nxJson = readJson('nx.json');
    const expoPlugin = nxJson.plugins.find(
      (plugin) => plugin.plugin === '@nx/expo/plugin'
    );
    expect(expoPlugin).toBeDefined();
    expect(expoPlugin.options).toBeDefined();
    expect(expoPlugin.options.exportTargetName).toEqual('export');
    expect(expoPlugin.options.startTargetName).toEqual('start');
  });

  it('should export the app', async () => {
    const result = runCLI(`export ${appName}`);
    checkFilesExist(
      `${appName}/dist/index.html`,
      `${appName}/dist/metadata.json`
    );

    expect(result).toContain(
      `Successfully ran target export for project ${appName}`
    );
  }, 200_000);

  it('should start the app', async () => {
    let process: ChildProcess;
    const port = 8081;

    try {
      process = await runCommandUntil(
        `start ${appName} --port=${port}`,
        (output) => output.includes(`http://localhost:8081`)
      );
    } catch (err) {
      console.error(err);
    }

    // port and process cleanup
    if (process && process.pid) {
      await killProcessAndPorts(process.pid, port);
    }
  });
});
