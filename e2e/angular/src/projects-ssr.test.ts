import {
  checkFilesDoNotExist,
  checkFilesExist,
  rmDist,
  runCLI,
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

  beforeAll(() => {
    setup = setupProjectsTest();
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
