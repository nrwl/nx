import { ChildProcess } from 'child_process';
import {
  runCLI,
  cleanupProject,
  newProject,
  uniq,
  readJson,
  runCommandUntil,
  killProcessAndPorts,
  fileExists,
} from 'e2e/utils';

describe('@nx/react-native/plugin', () => {
  let appName: string;

  beforeAll(() => {
    newProject();
    appName = uniq('app');
    runCLI(
      `generate @nx/react-native:app ${appName} --project-name-and-root-format=as-provided --install=false --no-interactive`,
      { env: { NX_PCV3: 'true' } }
    );
  });

  afterAll(() => cleanupProject());

  it('nx.json should contain plugin configuration', () => {
    const nxJson = readJson('nx.json');
    const reactNativePlugin = nxJson.plugins.find(
      (plugin) => plugin.plugin === '@nx/react-native/plugin'
    );
    expect(reactNativePlugin).toBeDefined();
    expect(reactNativePlugin.options).toBeDefined();
    expect(reactNativePlugin.options.bundleTargetName).toEqual('bundle');
    expect(reactNativePlugin.options.startTargetName).toEqual('start');
  });

  it('should bundle the app', async () => {
    const result = runCLI(
      `bundle ${appName} --platform=ios --bundle-output=dist.js --entry-file=src/main.tsx`
    );
    fileExists(` ${appName}/dist.js`);

    expect(result).toContain(
      `Successfully ran target bundle for project ${appName}`
    );
  }, 200_000);

  it('should start the app', async () => {
    let process: ChildProcess;
    const port = 8081;

    try {
      process = await runCommandUntil(
        `start ${appName} --no-interactive --port=${port}`,
        (output) => {
          return (
            output.includes(`http://localhost:${port}`) ||
            output.includes('Starting JS server...') ||
            output.includes('Welcome to Metro')
          );
        }
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
