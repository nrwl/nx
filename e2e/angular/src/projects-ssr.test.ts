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
  tmpProjPath,
  uniq,
  updateFile,
  waitUntil,
} from '@nx/e2e-utils';
import { chromium, type Browser, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
    const controlDirectory = mkdtempSync(join(tmpdir(), 'nx-ssr-reload-'));
    const applications: {
      name: string;
      devServerPort: number;
      serverPort: number;
      holdFile: string;
      startsFile: string;
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
          serverPort: await reservePort(),
          holdFile: join(controlDirectory, `${name}.hold`),
          startsFile: join(controlDirectory, `${name}.starts`),
          navigations: 0,
          failedNavigations: [],
          version: 0,
        };
        applications.push(application);
        writeFileSync(application.startsFile, '');
        runCLI(
          `generate @nx/angular:app ${name} --bundler=rspack --ssr --port=${application.devServerPort} --no-interactive`
        );
        updateFile(`${name}/src/server.ts`, (source) => {
          expect(source).toContain('const app = express();');
          const listenStatement =
            /  const server = app\.listen\(port, async \(error\?: Error\) => \{[\s\S]*?\n  \}\);/g;
          expect(source.match(listenStatement)).toHaveLength(1);
          return (
            `import { appendFileSync, existsSync } from 'node:fs';\n` +
            source
              .replace(
                'const app = express();',
                `const app = express();
const reloadVersion = '0';
app.use((_req, res, next) => {
  res.setHeader('x-ssr-reload-version', reloadVersion);
  next();
});`
              )
              .replace(
                listenStatement,
                (statement) => `  appendFileSync(${JSON.stringify(application.startsFile)}, reloadVersion + ':' + process.pid + '\\n');
  const listen = () => {
    if (existsSync(${JSON.stringify(application.holdFile)})) {
      setTimeout(listen, 10);
      return;
    }
${statement.replace(/^/gm, '  ')}
  };
  listen();`
              )
          );
        });
      }

      const app = applications[0].name;
      const serverPort = applications[0].serverPort;
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

      for (const application of applications) {
        application.process = await runCommandUntil(
          `serve ${application.name} -- --port=${application.devServerPort}`,
          (output) =>
            output.includes(
              `Node Express server listening on http://localhost:${application.serverPort}`
            ),
          { timeout: 120_000, env: { PORT: `${application.serverPort}` } }
        );
      }

      const response = await fetch(`http://localhost:${serverPort}/`);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('ng-server-context');
      const assetResponse = await fetch(
        `http://localhost:${serverPort}/favicon.ico`
      );
      expect(assetResponse.status).toBe(200);

      for (const application of applications) {
        application.version = 1;
        updateFile(`${application.name}/src/server.ts`, (source) =>
          source.replace(
            "const reloadVersion = '0'",
            "const reloadVersion = '1'"
          )
        );
        const deadline = Date.now() + 30_000;
        const signal = AbortSignal.timeout(30_000);
        let servedVersion: string | null = null;
        while (servedVersion !== '1' && Date.now() < deadline) {
          try {
            const response = await fetch(
              `http://localhost:${application.serverPort}/`,
              { signal }
            );
            servedVersion = response.headers.get('x-ssr-reload-version');
            await response.arrayBuffer();
          } catch {}
          if (servedVersion !== '1') {
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        }
        expect(servedVersion).toBe('1');
      }

      browser = await chromium.launch();
      const waitForReloadConnection = (page: Page) =>
        page.waitForEvent('console', {
          predicate: (message) =>
            message.text() ===
            '[AngularSSRDevServer] WebSocket connection established.',
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
        const connected = waitForReloadConnection(page);
        const [initial] = await Promise.all([
          page.goto(`http://localhost:${application.serverPort}/`),
          connected,
        ]);
        expect(initial?.headers()['x-ssr-reload-version']).toBe('1');
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
        const reloaded = page.waitForResponse(
          (response) =>
            response.request().isNavigationRequest() &&
            response.headers()['x-ssr-reload-version'] ===
              `${application.version}`
        );
        const finished = Promise.all([
          reloaded,
          waitForReloadConnection(page),
          waitUntil(
            () =>
              readFileSync(application.startsFile, 'utf8')
                .trim()
                .split('\n')
                .some((start) => start.startsWith(`${application.version}:`)),
            { timeout: 30_000, ms: 50 }
          ).then(async () => {
            await page.evaluate(
              () =>
                new Promise<void>((resolve) => {
                  globalThis.requestAnimationFrame(() =>
                    globalThis.requestAnimationFrame(() => resolve())
                  );
                })
            );
            expect(application.navigations).toBe(
              navigationCounts.get(application)
            );
            expect(application.failedNavigations).toEqual([]);
            rmSync(application.holdFile);
          }),
        ]);
        writeFileSync(application.holdFile, '');
        updateFile(`${application.name}/src/server.ts`, (source) =>
          source.replace(
            `const reloadVersion = '${previousVersion}'`,
            `const reloadVersion = '${application.version}'`
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
          if (current.version > 1) {
            expect(
              readFileSync(current.startsFile, 'utf8')
                .trim()
                .split('\n')
                .filter((start) => start.startsWith(`${current.version}:`))
            ).toHaveLength(1);
          }
        }
      }
    } finally {
      for (const application of applications) {
        rmSync(application.holdFile, { force: true });
      }
      await browser?.close();
      await Promise.all(
        applications.map((application) =>
          killProcessAndPorts(
            application.process?.pid,
            application.devServerPort,
            application.serverPort
          )
        )
      );
      rmSync(controlDirectory, { recursive: true, force: true });
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
