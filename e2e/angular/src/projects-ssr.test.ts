import {
  addReadyUrlCheck,
  checkFilesDoNotExist,
  checkFilesExist,
  expectServedOn,
  killProcessAndPorts,
  readFile,
  readJson,
  reservePort,
  rmDist,
  runCLI,
  runCommandUntil,
  shouldRunPlaywrightTests,
  tmpProjPath,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import {
  chromium,
  type Browser,
  type Page,
  type WebSocket,
} from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
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

  it('should support the application engine and independent reloads for concurrent rspack SSR applications', async () => {
    const applications: {
      name: string;
      devServerPort: number;
      process?: ChildProcess;
      page?: Page;
      navigations: number;
      failedNavigations: string[];
      version: number;
    }[] = [];
    let browser: Browser | undefined;

    try {
      for (let index = 0; index < 2; index++) {
        const name = uniq('rspack-ssr-app');
        const application = {
          name,
          devServerPort: await reservePort(),
          navigations: 0,
          failedNavigations: [],
          version: 0,
        };
        applications.push(application);
        runCLI(
          `generate @nx/angular:app ${name} --bundler=rspack --ssr --port=${application.devServerPort} --no-interactive`
        );
        addReadyUrlCheck(name, 'serve');
        updateFile(`${name}/rspack.config.ts`, (source) => {
          const indexOption = /index:\s*(['"])\.\/src\/index\.html\1/g;
          expect(source.match(indexOption)).toHaveLength(1);
          return source.replace(
            indexOption,
            () => `index: {
      input: './src/index.html',
      transformer: async (content) => content.replace(
        /<body([^>]*)>/,
        '<body$1><div id="index-transform-marker" hidden></div>'
      ),
    }`
          );
        });
        updateFile(`${name}/src/server.ts`, (source) => {
          expect(source).toContain('const app = express();');
          return source.replace(
            'const app = express();',
            `const app = express();
const serverVersion = '0';
app.use((_req, res, next) => {
  res.setHeader('x-server-version', serverVersion);
  next();
});`
          );
        });
      }

      const app = applications[0].name;
      const serverPort = await reservePort();
      // only rendering the page reveals this rule as critical CSS
      updateFile(`${app}/src/styles.css`, `.page-only{color:red}`);
      updateFile(
        `${app}/src/app/app.html`,
        (content) => `<p class="page-only">page</p>\n${content}`
      );

      runCLI(`build ${app}`);
      checkFilesExist(
        `dist/${app}/browser/index.html`,
        `dist/${app}/server/server.js`
      );
      // the "prerender" build option still renders at build time, unlike
      // "RenderMode.Prerender", which the generated server routes use
      const prerenderedPage = readFile(`dist/${app}/browser/index.html`);
      expect(prerenderedPage).toContain('ng-server-context');
      expect(prerenderedPage).toContain('id="index-transform-marker"');
      expect(prerenderedPage).toMatch(/<style[^>]*>[^<]*\.page-only\{/);
      // critical CSS inlined twice defers the stylesheet to a print media query
      // that never switches back
      expect(prerenderedPage).not.toContain('data-beasties-media="print"');
      expect(
        readJson(`dist/${app}/prerendered-routes.json`).routes
      ).toHaveProperty('/');

      const productionServer = spawn(
        process.execPath,
        [`dist/${app}/server/server.js`],
        {
          cwd: tmpProjPath(),
          env: {
            ...process.env,
            PORT: `${serverPort}`,
            NG_ALLOWED_HOSTS: 'localhost',
          },
        }
      );
      try {
        await new Promise<void>((resolve, reject) => {
          productionServer.stdout.on('data', (data) => {
            if (data.toString().includes('Node Express server listening')) {
              resolve();
            }
          });
          productionServer.on('exit', (code) =>
            reject(new Error(`The server exited with code ${code}.`))
          );
        });
        const response = await fetch(`http://localhost:${serverPort}/`);
        const page = await response.text();
        expect(page).toMatch(/<style[^>]*>[^<]*\.page-only\{/);
        expect(page).not.toContain('data-beasties-media="print"');
        expect(page.match(/id="ng-state"/g)).toHaveLength(1);
      } finally {
        await killProcessAndPorts(productionServer.pid, serverPort);
      }

      // Both apps report their own dev-server URL once it renders.
      const readyOutput = runCLI(
        `run-many -t check -p ${applications.map(({ name }) => name).join(' ')} --output-style=static`
      );
      for (const application of applications) {
        expectServedOn(readyOutput, application.devServerPort);
      }

      for (const application of applications) {
        application.process = await runCommandUntil(
          `serve ${application.name} -- --port=${application.devServerPort}`,
          (output) =>
            output.includes(`Listening on port: ${application.devServerPort}`),
          { timeout: 120_000 }
        );
      }

      for (const application of applications) {
        const devServerUrl = `http://localhost:${application.devServerPort}`;
        const response = await fetch(`${devServerUrl}/`, {
          headers: { accept: 'text/html' },
        });
        expect(response.status).toBe(200);
        const page = await response.text();
        expect(page).toContain('ng-server-context');
        if (application.name === app) {
          expect(page).toContain('id="index-transform-marker"');
        }
        expect((await fetch(`${devServerUrl}/favicon.ico`)).status).toBe(200);
      }

      for (const application of applications) {
        application.version = 1;
        updateFile(`${application.name}/src/server.ts`, (source) =>
          source.replace(
            "const serverVersion = '0'",
            "const serverVersion = '1'"
          )
        );
        // The dev server holds requests until the server bundle of the edit loads.
        const deadline = Date.now() + 30_000;
        let servedVersion: string | null = null;
        while (servedVersion !== '1' && Date.now() < deadline) {
          const response = await fetch(
            `http://localhost:${application.devServerPort}/`,
            { signal: AbortSignal.timeout(30_000) }
          );
          servedVersion = response.headers.get('x-server-version');
          await response.arrayBuffer();
          if (servedVersion !== '1') {
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        }
        expect(servedVersion).toBe('1');
      }

      if (!(await shouldRunPlaywrightTests())) {
        return;
      }

      browser = await chromium.launch();
      // The dev server sends `ok` on a new socket once the build has no errors.
      const waitForDevServerSocket = (page: Page) =>
        new Promise<void>((resolve) => {
          const onSocket = (socket: WebSocket) =>
            socket.on('framereceived', ({ payload }) => {
              if (
                typeof payload === 'string' &&
                payload.includes('"type":"ok"')
              ) {
                page.off('websocket', onSocket);
                resolve();
              }
            });
          page.on('websocket', onSocket);
        });
      for (const application of applications) {
        const page = (application.page = await browser.newPage());
        page.on('request', (request) => {
          if (
            request.isNavigationRequest() &&
            request.frame() === page.mainFrame()
          ) {
            application.navigations++;
          }
        });
        page.on('requestfailed', (request) => {
          if (
            request.isNavigationRequest() &&
            request.frame() === page.mainFrame()
          ) {
            application.failedNavigations.push(request.url());
          }
        });
        const connected = waitForDevServerSocket(page);
        const [initial] = await Promise.all([
          page.goto(`http://localhost:${application.devServerPort}/`),
          connected,
        ]);
        expect(initial?.headers()['x-server-version']).toBe('1');
      }

      for (const application of [
        applications[0],
        applications[0],
        applications[1],
      ]) {
        const page = application.page!;
        const navigationCounts = new Map(
          applications.map((current) => [current, current.navigations])
        );
        const previousVersion = application.version++;
        const finished = Promise.all([
          page.waitForResponse(
            (response) =>
              response.request().isNavigationRequest() &&
              response.headers()['x-server-version'] ===
                `${application.version}`
          ),
          waitForDevServerSocket(page),
        ]);
        updateFile(`${application.name}/src/server.ts`, (source) =>
          source.replace(
            `const serverVersion = '${previousVersion}'`,
            `const serverVersion = '${application.version}'`
          )
        );

        const [response] = await finished;
        expect(response.status()).toBe(200);
        await page.waitForLoadState('load');
        for (const current of applications) {
          expect(current.navigations).toBe(
            navigationCounts.get(current)! + Number(current === application)
          );
          expect(current.failedNavigations).toEqual([]);
        }
      }
    } finally {
      await browser?.close();
      await Promise.all(
        applications.map((application) =>
          killProcessAndPorts(
            application.process?.pid,
            application.devServerPort
          )
        )
      );
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
