import { stringUtils } from '@nrwl/workspace';
import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  createFile,
  isNotWindows,
  killPorts,
  newProject,
  promisifiedTreeKill,
  readFile,
  readJson,
  runCLI,
  runCLIAsync,
  runCommandUntil,
  runCypressTests,
  uniq,
  updateFile,
  updateProjectConfig,
} from '@nrwl/e2e/utils';
import * as http from 'http';

describe('Next.js Applications', () => {
  let proj: string;

  beforeAll(() => (proj = newProject()));

  afterAll(() => cleanupProject());

  it('should generate app + libs', async () => {
    const appName = uniq('app');
    const reactLib = uniq('reactlib');
    const jsLib = uniq('tslib');

    runCLI(`generate @nrwl/next:app ${appName} --no-interactive --style=css`);
    runCLI(`generate @nrwl/react:lib ${reactLib} --no-interactive`);
    runCLI(`generate @nrwl/js:lib ${jsLib} --no-interactive`);

    // Create file in public that should not be copied to dist since it's not declared
    updateFile(`apps/${appName}/a/b.txt`, `Hello World!`);

    // Additional assets that should be copied to dist
    const sharedLib = uniq('sharedLib');
    updateProjectConfig(appName, (json) => {
      json.targets.build.options.assets = [
        {
          glob: '**/*',
          input: `libs/${sharedLib}/src/assets`,
          output: 'shared/ui',
        },
      ];
      return json;
    });
    updateFile(`libs/${sharedLib}/src/assets/hello.txt`, 'Hello World!');

    // create a css file in node_modules so that it can be imported in a lib
    // to test that it works as expected
    updateFile(
      'node_modules/@nrwl/next/test-styles.css',
      'h1 { background-color: red; }'
    );

    updateFile(
      `libs/${jsLib}/src/lib/${jsLib}.ts`,
      `
          export function testFn(): string {
            return 'Hello Nx';
          };

          // testing whether async-await code in Node / Next.js api routes works as expected
          export async function testAsyncFn() {
            return await Promise.resolve('hell0');
          }
          `
    );

    const mainPath = `apps/${appName}/pages/index.tsx`;
    const content = readFile(mainPath);

    updateFile(
      `apps/${appName}/pages/api/hello.ts`,
      `
          import { testAsyncFn } from '@${proj}/${jsLib}';

          export default async function handler(_, res) {
            const value = await testAsyncFn();
            res.send(value);
          }
        `
    );

    updateFile(
      mainPath,
      `
          import { testFn } from '@${proj}/${jsLib}';
          /* eslint-disable */
          import dynamic from 'next/dynamic';

          const TestComponent = dynamic(
              () => import('@${proj}/${reactLib}').then(d => d.${stringUtils.capitalize(
        reactLib
      )})
            );
          ${content.replace(
            `</h2>`,
            `</h2>
                <div>
                  {testFn()}
                  <TestComponent />
                </div>
              `
          )}`
    );

    const e2eTestPath = `apps/${appName}-e2e/src/integration/app.spec.ts`;
    const e2eContent = readFile(e2eTestPath);
    updateFile(
      e2eTestPath,
      `
        ${
          e2eContent +
          `
          it('should successfully call async API route', () => {
            cy.request('/api/hello').its('body').should('include', 'hell0');
          });
          `
        }
      `
    );

    await checkApp(appName, {
      checkUnitTest: true,
      checkLint: true,
      checkE2E: isNotWindows(),
      checkExport: false,
    });

    // declared assets should be copied to dist
    checkFilesExist(`dist/apps/${appName}/.next/shared/ui/hello.txt`);

    // undeclared asset should not be copied to dist
    checkFilesDoNotExist(`dist/apps/${appName}/.next/a/b.txt`);
  }, 300000);

  it('should be able to serve with a proxy configuration', async () => {
    const appName = uniq('app');
    const port = 4201;

    runCLI(`generate @nrwl/next:app ${appName}`);

    const proxyConf = {
      '/external-api': {
        target: `http://localhost:${port}`,
        pathRewrite: {
          '^/external-api/hello': '/api/hello',
        },
      },
    };
    updateFile(`apps/${appName}/proxy.conf.json`, JSON.stringify(proxyConf));
    updateFile('.env.local', 'NX_CUSTOM_VAR=test value from a file');

    updateFile(
      `apps/${appName}/pages/index.tsx`,
      `
        import React from 'react';
        
        export const Index = ({ greeting }: any) => {
          return (
            <p>{process.env.NX_CUSTOM_VAR}</p>
          );
        };
        export default Index;
      `
    );

    updateFile(
      `apps/${appName}/pages/api/hello.js`,
      `
        export default (_req, res) => {
          res.status(200).send('Welcome');
        };
      `
    );

    // serve Next.js
    const p = await runCommandUntil(
      `run ${appName}:serve --port=${port}`,
      (output) => {
        return output.indexOf(`[ ready ] on http://localhost:${port}`) > -1;
      }
    );

    const apiData = await getData(port, '/external-api/hello');
    const pageData = await getData(port, '/');
    expect(apiData).toContain(`Welcome`);
    expect(pageData).toContain(`test value from a file`);

    try {
      await promisifiedTreeKill(p.pid, 'SIGKILL');
      expect(await killPorts(port)).toBeTruthy();
    } catch (err) {
      expect(err).toBeFalsy();
    }
  }, 300000);

  it('should build with a next.config.js file in the dist folder', async () => {
    const appName = uniq('app');

    runCLI(`generate @nrwl/next:app ${appName} --no-interactive --style=css`);

    updateFile(
      `apps/${appName}/next.config.js`,
      `
      module.exports = {
        webpack: (c) => {
          console.log('NODE_ENV is', process.env.NODE_ENV);
          return c;
        }
      }
      `
    );
    // deleting `NODE_ENV` value, so that it's `undefined`, and not `"test"`
    // by the time it reaches the build executor.
    // this simulates existing behaviour of running a next.js build executor via Nx
    delete process.env.NODE_ENV;
    const result = runCLI(`build ${appName}`);

    checkFilesExist(`dist/apps/${appName}/next.config.js`);
    expect(result).toContain('NODE_ENV is production');
  }, 300000);

  it('should support --js flag', async () => {
    const appName = uniq('app');

    runCLI(`generate @nrwl/next:app ${appName} --no-interactive --js`);

    checkFilesExist(`apps/${appName}/pages/index.js`);

    await checkApp(appName, {
      checkUnitTest: true,
      checkLint: true,
      checkE2E: false,
      checkExport: false,
    });

    // Consume a JS lib
    const libName = uniq('lib');

    runCLI(
      `generate @nrwl/react:lib ${libName} --no-interactive --style=none --js`
    );

    const mainPath = `apps/${appName}/pages/index.js`;
    updateFile(
      mainPath,
      `import '@${proj}/${libName}';\n` + readFile(mainPath)
    );

    // Update lib to use css modules
    updateFile(
      `libs/${libName}/src/lib/${libName}.js`,
      `
          import styles from './style.module.css';
          export function Test() {
            return <div className={styles.container}>Hello</div>;
          }
        `
    );
    updateFile(
      `libs/${libName}/src/lib/style.module.css`,
      `
          .container {}
        `
    );

    await checkApp(appName, {
      checkUnitTest: true,
      checkLint: true,
      checkE2E: false,
      checkExport: false,
    });
  }, 300000);

  it('should support --no-swc flag', async () => {
    const appName = uniq('app');

    runCLI(`generate @nrwl/next:app ${appName} --no-interactive --no-swc`);

    // Next.js enables SWC when custom .babelrc is not provided.
    checkFilesExist(`apps/${appName}/.babelrc`);

    await checkApp(appName, {
      checkUnitTest: false,
      checkLint: false,
      checkE2E: false,
      checkExport: true,
    });
  }, 300000);

  it('should allow using a custom server implementation in TypeScript', async () => {
    const appName = uniq('app');
    const port = 4202;

    // generate next.js app
    runCLI(`generate @nrwl/next:app ${appName} --no-interactive`);

    // create custom server
    createFile(
      'tools/custom-next-server.ts',
      `
      const express = require('express');
      const path = require('path');

      export default async function nextCustomServer(app, settings, proxyConfig) {
        const handle = app.getRequestHandler();
        await app.prepare();

        const x: string = 'custom typescript server running';
        console.log(x);

        const server = express();
        server.disable('x-powered-by');

        server.use(
          express.static(path.resolve(settings.dir, settings.conf.outdir, 'public'))
        );

        // Default catch-all handler to allow Next.js to handle all other routes
        server.all('*', (req, res) => handle(req, res));

        server.listen(settings.port, settings.hostname);
      }
    `
    );

    updateProjectConfig(appName, (config) => {
      config.targets.serve.options.customServerPath =
        '../../tools/custom-next-server.ts';

      return config;
    });

    // serve Next.js
    const p = await runCommandUntil(
      `run ${appName}:serve --port=${port}`,
      (output) => {
        return output.indexOf(`[ ready ] on http://localhost:${port}`) > -1;
      }
    );

    const data = await getData(port);
    expect(data).toContain(`Welcome`);

    try {
      await promisifiedTreeKill(p.pid, 'SIGKILL');
      await killPorts(port);
    } catch (err) {
      expect(err).toBeFalsy();
    }
  }, 300000);

  it('should support different --style options', async () => {
    const lessApp = uniq('app');

    runCLI(`generate @nrwl/next:app ${lessApp} --no-interactive --style=less`);

    await checkApp(lessApp, {
      checkUnitTest: false,
      checkLint: false,
      checkE2E: false,
      checkExport: false,
    });

    const stylusApp = uniq('app');

    runCLI(
      `generate @nrwl/next:app ${stylusApp} --no-interactive --style=styl`
    );

    await checkApp(stylusApp, {
      checkUnitTest: false,
      checkLint: false,
      checkE2E: false,
      checkExport: false,
    });

    const scApp = uniq('app');

    runCLI(
      `generate @nrwl/next:app ${scApp} --no-interactive --style=styled-components`
    );

    await checkApp(scApp, {
      checkUnitTest: true,
      checkLint: false,
      checkE2E: false,
      checkExport: false,
    });

    const emotionApp = uniq('app');

    runCLI(
      `generate @nrwl/next:app ${emotionApp} --no-interactive --style=@emotion/styled`
    );

    await checkApp(emotionApp, {
      checkUnitTest: true,
      checkLint: false,
      checkE2E: false,
      checkExport: false,
    });
  }, 300000);
});

function getData(port: number, path = ''): Promise<any> {
  return new Promise((resolve) => {
    http.get(`http://localhost:${port}${path}`, (res) => {
      expect(res.statusCode).toEqual(200);
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.once('end', () => {
        resolve(data);
      });
    });
  });
}

async function checkApp(
  appName: string,
  opts: {
    checkUnitTest: boolean;
    checkLint: boolean;
    checkE2E: boolean;
    checkExport: boolean;
  }
) {
  const buildResult = runCLI(`build ${appName}`);
  expect(buildResult).toContain(`Compiled successfully`);
  checkFilesExist(`dist/apps/${appName}/.next/build-manifest.json`);

  const packageJson = readJson(`dist/apps/${appName}/package.json`);
  expect(packageJson.dependencies.react).toBeDefined();
  expect(packageJson.dependencies['react-dom']).toBeDefined();
  expect(packageJson.dependencies.next).toBeDefined();

  if (opts.checkLint) {
    const lintResults = runCLI(`lint ${appName}`);
    expect(lintResults).toContain('All files pass linting.');
  }

  if (opts.checkUnitTest) {
    const testResults = await runCLIAsync(`test ${appName}`);
    expect(testResults.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );
  }

  if (opts.checkE2E && runCypressTests()) {
    const e2eResults = runCLI(`e2e ${appName}-e2e --no-watch`);
    expect(e2eResults).toContain('All specs passed!');
    expect(await killPorts()).toBeTruthy();
  }

  if (opts.checkExport) {
    runCLI(`export ${appName}`);
    checkFilesExist(`dist/apps/${appName}/exported/index.html`);
  }
}
