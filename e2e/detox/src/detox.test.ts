import {
  runCLI,
  cleanupProject,
  newProject,
  uniq,
  readJson,
  updateJson,
} from 'e2e/utils';

describe('@nx/detox', () => {
  let project: string;
  let reactNativeAppName: string;
  let expoAppName: string;

  beforeAll(() => {
    project = newProject();
    reactNativeAppName = uniq('appTest');
    expoAppName = uniq('expoAppTest');
    runCLI(
      `generate @nx/react-native:app ${reactNativeAppName} --e2eTestRunner=detox --install=false --interactive=false`
    );
    runCLI(
      `generate @nx/expo:app ${expoAppName} --e2eTestRunner=detox --interactive=false`
    );
    updateAppDetoxJson(reactNativeAppName);
    updateAppDetoxJson(expoAppName);
  });

  afterAll(() => cleanupProject());

  it('nx.json should contain plugin configuration', () => {
    const nxJson = readJson('nx.json');
    const detoxPlugin = nxJson.plugins.find(
      (plugin) => plugin.plugin === '@nx/detox/plugin'
    );
    expect(detoxPlugin).toBeDefined();
    expect(detoxPlugin.options).toBeDefined();
    expect(detoxPlugin.options.buildTargetName).toEqual('build');
    expect(detoxPlugin.options.testTargetName).toEqual('test');
    expect(detoxPlugin.options.startTargetName).toEqual('start');
  });

  it('should build the app', async () => {
    const result = runCLI(
      `build ${reactNativeAppName}-e2e -- --configuration e2e.sim.debug`
    );
    expect(result).toContain(`building ${reactNativeAppName}`);
    expect(result).toContain(
      `Successfully ran target build for project ${reactNativeAppName}`
    );

    const expoResult = runCLI(
      `build ${expoAppName}-e2e -- --configuration e2e.sim.debug`
    );
    expect(expoResult).toContain(`building ${expoAppName}`);
    expect(expoResult).toContain(
      `Successfully ran target build for project ${expoAppName}`
    );
  }, 200_000);
});

function updateAppDetoxJson(appName: string) {
  updateJson(`${appName}-e2e/.detoxrc.json`, (json) => {
    json.apps['e2e.debug'] = {
      type: 'ios.app',
      build: `echo "building ${appName}"`,
      binaryPath: 'dist',
    };
    json.configurations['e2e.sim.debug'] = {
      device: 'simulator',
      app: 'e2e.debug',
    };
    return json;
  });
}
