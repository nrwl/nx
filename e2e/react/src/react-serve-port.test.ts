import {
  cleanupProject,
  newProject,
  readFile,
  readJson,
  runCLI,
  uniq,
  updateJson,
} from '@nx/e2e-utils';

describe('React app dev-server port', () => {
  beforeAll(() => {
    newProject({
      packages: ['@nx/react', '@nx/webpack', '@nx/cypress'],
    });

    updateJson('nx.json', (json) => {
      json.targetDefaults ??= {};
      json.targetDefaults.serve = { options: { port: 4300 } };
      return json;
    });
  });

  afterAll(() => cleanupProject());

  // The plugin path resolves the e2e URL through devkit's
  // getE2EWebServerInfoForPlugin, which used to re-apply targetDefaults on top of
  // an already-resolved port and rewrite only the dev-server address.
  it('should honour an explicit --port in the e2e config on the plugin path', () => {
    const app = uniq('port-plugin');

    runCLI(
      `generate @nx/react:app apps/${app} --bundler=webpack --e2eTestRunner=cypress --port=4321 --no-interactive`
    );

    const cypressConfig = readFile(`apps/${app}-e2e/cypress.config.ts`);
    expect(cypressConfig).toContain('4321');
    expect(cypressConfig).not.toContain('4300');
  });

  // The executor path is the one that writes the port onto the serve target;
  // with the plugin registered, project.json carries no serve target at all.
  it('should write an explicit --port onto the serve target on the executor path', () => {
    const app = uniq('port-executor');

    runCLI(
      `generate @nx/react:app apps/${app} --bundler=webpack --e2eTestRunner=cypress --port=4321 --addPlugin=false --no-interactive`
    );

    const serve = readJson(`apps/${app}/project.json`).targets.serve;
    expect(serve.options.port).toBe(4321);

    const cypressConfig = readFile(`apps/${app}-e2e/cypress.config.ts`);
    expect(cypressConfig).toContain('4321');
    expect(cypressConfig).not.toContain('4300');
  });
});
