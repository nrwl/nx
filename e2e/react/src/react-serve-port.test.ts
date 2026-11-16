import {
  cleanupProject,
  newProject,
  readFile,
  reservePorts,
  runCLI,
  uniq,
  updateJson,
} from '@nx/e2e-utils';

describe('React app dev-server port', () => {
  // Two distinct ports: one the workspace defaults to, one the generator is asked
  // for. The test asserts the requested one wins, so they must not be equal.
  // Reserved rather than hard-coded so a parallel suite cannot serve on either.
  // Assertions match `localhost:<port>` rather than the bare number: the app name
  // carries random digits from uniq() that a bare port could match inside.
  let defaultPort: number;
  let requestedPort: number;

  beforeAll(async () => {
    [defaultPort, requestedPort] = await reservePorts(2);

    newProject({
      packages: ['@nx/react', '@nx/webpack', '@nx/cypress'],
    });

    updateJson('nx.json', (json) => {
      json.targetDefaults ??= {};
      json.targetDefaults.serve = { options: { port: defaultPort } };
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
      `generate @nx/react:app apps/${app} --bundler=webpack --e2eTestRunner=cypress --port=${requestedPort} --no-interactive`
    );

    const cypressConfig = readFile(`apps/${app}-e2e/cypress.config.ts`);
    expect(cypressConfig).toContain(`localhost:${requestedPort}`);
    expect(cypressConfig).not.toContain(`localhost:${defaultPort}`);
  });
});
