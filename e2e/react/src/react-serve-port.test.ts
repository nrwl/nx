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
  });

  afterAll(() => cleanupProject());

  // An explicitly requested port must beat a workspace-wide targetDefaults port,
  // and the generated e2e config must point at the same server the app serves on.
  // Before this was fixed the serve target honoured --port while the e2e config
  // kept the targetDefaults port, so cypress waited on a port nothing listened to.
  it('should honour an explicit --port over targetDefaults, in both the serve target and the e2e config', () => {
    const app = uniq('port-app');

    updateJson('nx.json', (json) => {
      json.targetDefaults ??= {};
      json.targetDefaults.serve = { options: { port: 4300 } };
      return json;
    });

    runCLI(
      `generate @nx/react:app apps/${app} --bundler=webpack --e2eTestRunner=cypress --port=4321 --no-interactive`
    );

    // the serve target carries the requested port, not the workspace default
    const serve = readJson(`apps/${app}/project.json`).targets.serve;
    expect(serve.options.port).toBe(4321);

    // and the generated cypress config agrees with it
    const cypressConfig = readFile(`apps/${app}-e2e/cypress.config.ts`);
    expect(cypressConfig).toContain('4321');
    expect(cypressConfig).not.toContain('4300');
  });
});
