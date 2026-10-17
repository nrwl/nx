import {
  cleanupProject,
  newProject,
  reservePort,
  runCLI,
  uniq,
  updateJson,
} from '@nx/e2e-utils';

// The serve targets the bundler plugins infer are ready on the dev server's
// signal, which carries the address it listens on
describe('React app dev-server readiness', () => {
  beforeAll(() => {
    newProject({
      packages: ['@nx/react', '@nx/webpack', '@nx/vite', '@nx/vitest'],
    });
  });

  afterAll(() => cleanupProject());

  // The check reaches the server only through the url the signal carried, so
  // it passes only if Nx waited for the signal and passed the url on
  function addReadyUrlCheck(app: string, serveTarget: string) {
    updateJson(`apps/${app}/project.json`, (config) => {
      config.targets ??= {};
      config.targets.check = {
        command:
          "node -e \"const url = process.env.NX_READY_URL; console.log('URL=' + url); require('http').get(url, (r) => { console.log('STATUS=' + r.statusCode); process.exit(r.statusCode < 400 ? 0 : 1); })\"",
        dependsOn: [{ target: serveTarget, waitFor: 'ready' }],
      };
      return config;
    });
  }

  // The server binds whichever loopback address the platform resolves
  // `localhost` to; the port is the one the generator was asked for
  function expectServedOn(output: string, port: number) {
    expect(output).toMatch(
      new RegExp(`URL=http://(localhost|127\\.0\\.0\\.1|\\[::1\\]):${port}/`)
    );
    expect(output).toMatch(/STATUS=[23]\d\d/);
  }

  it('should run a task that waits for the webpack dev server once it listens', async () => {
    const app = uniq('webpack-app');
    const port = await reservePort();
    runCLI(
      `generate @nx/react:app apps/${app} --bundler=webpack --linter=none --unitTestRunner=none --e2eTestRunner=none --port=${port} --no-interactive`
    );
    addReadyUrlCheck(app, 'serve');

    const output = runCLI(`run ${app}:check`);
    expectServedOn(output, port);
    expect(output).toContain(
      `Successfully ran target check for project ${app}`
    );
  }, 300_000);

  it('should run a task that waits for the vite dev server once it listens', async () => {
    const app = uniq('vite-app');
    const port = await reservePort();
    runCLI(
      `generate @nx/react:app apps/${app} --bundler=vite --linter=none --unitTestRunner=none --e2eTestRunner=none --port=${port} --no-interactive`
    );
    addReadyUrlCheck(app, 'dev');

    const output = runCLI(`run ${app}:check`);
    expectServedOn(output, port);
    expect(output).toContain(
      `Successfully ran target check for project ${app}`
    );
  }, 300_000);
});
