import {
  addReadyUrlCheck,
  cleanupProject,
  expectServedOn,
  newProject,
  reservePort,
  runCLI,
  uniq,
} from '@nx/e2e-utils';

describe('Angular app dev-server readiness', () => {
  beforeAll(() => {
    newProject({ packages: ['@nx/angular'] });
  });

  afterAll(() => cleanupProject());

  it('should run a task that waits for the Angular dev server once it listens', async () => {
    const app = uniq('ng-app');
    const port = await reservePort();
    runCLI(
      `generate @nx/angular:app apps/${app} --bundler=esbuild --linter=none --unitTestRunner=none --e2eTestRunner=none --port=${port} --no-interactive`
    );
    addReadyUrlCheck(`apps/${app}`, 'serve');

    const output = runCLI(`run ${app}:check`);
    expectServedOn(output, port);
    expect(output).toContain(
      `Successfully ran target check for project ${app}`
    );
  }, 300_000);
});
