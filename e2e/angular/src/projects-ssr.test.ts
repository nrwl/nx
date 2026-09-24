import {
  checkFilesDoNotExist,
  checkFilesExist,
  killProcessAndPorts,
  readFile,
  readJson,
  reservePort,
  rmDist,
  runCLI,
  runCommandUntil,
  uniq,
} from '@nx/e2e-utils';
import {
  setupProjectsTest,
  resetProjectsTest,
  cleanupProjectsTest,
  ProjectsTestSetup,
} from './projects-setup';

describe('Angular Projects - SSR', () => {
  let setup: ProjectsTestSetup;

  beforeAll(async () => {
    setup = await setupProjectsTest();
  });

  afterEach(() => {
    resetProjectsTest(setup);
  });

  afterAll(() => cleanupProjectsTest());

  it('should support generating applications with SSR and converting targets with webpack-based executors to use the application executor', async () => {
    const esbuildApp = uniq('esbuild-app');
    const webpackApp = uniq('webpack-app');

    runCLI(
      `generate @nx/angular:app ${esbuildApp} --bundler=esbuild --ssr --no-interactive`
    );

    // check build produces both the browser and server bundles
    runCLI(`build ${esbuildApp} --output-hashing none`);
    checkFilesExist(
      `dist/${esbuildApp}/browser/main.js`,
      `dist/${esbuildApp}/server/server.mjs`
    );

    runCLI(
      `generate @nx/angular:app ${webpackApp} --bundler=webpack --ssr --no-interactive`
    );

    // check build only produces the browser bundle
    runCLI(`build ${webpackApp} --output-hashing none`);
    checkFilesExist(`dist/${webpackApp}/browser/main.js`);
    checkFilesDoNotExist(`dist/${webpackApp}/server/main.js`);

    // check server produces the server bundle
    runCLI(`server ${webpackApp} --output-hashing none`);
    checkFilesExist(`dist/${webpackApp}/server/main.js`);

    rmDist();

    // convert target with webpack-based executors to use the application executor
    runCLI(
      `generate @nx/angular:convert-to-application-executor ${webpackApp}`
    );

    // check build now produces both the browser and server bundles
    runCLI(`build ${webpackApp} --output-hashing none`);
    checkFilesExist(
      `dist/${webpackApp}/browser/main.js`,
      `dist/${webpackApp}/server/server.mjs`
    );

    // check server target is no longer available
    expect(() =>
      runCLI(`server ${webpackApp} --output-hashing none`)
    ).toThrow();
  }, 500_000);

  it('should support generating an application with SSR and rspack that renders with the application engine', async () => {
    const app = uniq('rspack-ssr-app');
    const devServerPort = await reservePort();
    const serverPort = await reservePort();

    runCLI(
      `generate @nx/angular:app ${app} --bundler=rspack --ssr --port=${devServerPort} --no-interactive`
    );

    runCLI(`build ${app}`);
    checkFilesExist(
      `dist/${app}/browser/index.html`,
      `dist/${app}/server/server.js`
    );
    // the "prerender" build option still renders at build time, unlike
    // "RenderMode.Prerender", which the generated server routes use
    expect(readFile(`dist/${app}/browser/index.html`)).toContain(
      'ng-server-context'
    );
    expect(
      readJson(`dist/${app}/prerendered-routes.json`).routes
    ).toHaveProperty('/');

    // the application engine needs the manifests the build registers, so a
    // server that starts and renders proves they are wired up
    const serveProcess = await runCommandUntil(
      `serve ${app} -- --port=${devServerPort}`,
      (output) =>
        output.includes(
          `Node Express server listening on http://localhost:${serverPort}`
        ),
      { timeout: 120_000, env: { PORT: `${serverPort}` } }
    );

    try {
      const response = await fetch(`http://localhost:${serverPort}/`);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('ng-server-context');

      // the static middleware runs before the engine, so an emitted asset is
      // served rather than rendered
      const assetResponse = await fetch(
        `http://localhost:${serverPort}/favicon.ico`
      );
      expect(assetResponse.status).toBe(200);
    } finally {
      await killProcessAndPorts(serveProcess.pid, devServerPort, serverPort);
    }
  }, 500_000);

  // TODO: enable this test once vitest issue is resolved
  it.skip('should generate apps and libs with vitest', async () => {
    const app = uniq('app');
    const lib = uniq('lib');

    runCLI(
      `generate @nx/angular:app ${app} --unit-test-runner=vitest --no-interactive`
    );
    runCLI(
      `generate @nx/angular:lib ${lib} --unit-test-runner=vitest --no-interactive`
    );

    // Make sure we are using vitest
    checkFilesExist(`${app}/vite.config.mts`, `${lib}/vite.config.mts`);

    runCLI(`run-many --target test --projects=${app},${lib} --parallel`);
  });
});
