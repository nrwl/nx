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
  let appName: string;

  beforeAll(() => {
    project = newProject();
    appName = uniq('app');
    runCLI(
      `generate @nx/react-native:app ${appName} --e2eTestRunner=detox --install=false --project-name-and-root-format=as-provided --interactive=false`
    );
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
      `build ${appName}-e2e -- --configuration e2e.sim.debug`
    );

    expect(result).toContain(`building ${appName}`);
    expect(result).toContain(
      `Successfully ran target build for project ${appName}`
    );
  }, 200_000);
});
