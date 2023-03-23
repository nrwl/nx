import { detectPackageManager, joinPathFragments } from '@nrwl/devkit';
import { capitalize } from '@nrwl/devkit/src/utils/string-utils';
import {
  checkFilesExist,
  cleanupProject,
  getPackageManagerCommand,
  isNotWindows,
  killPort,
  killPorts,
  newProject,
  packageManagerLockFile,
  readFile,
  rmDist,
  runCLI,
  runCommand,
  runCommandUntil,
  tmpProjPath,
  uniq,
  updateFile,
  updateProjectConfig,
} from '@nrwl/e2e/utils';
import * as http from 'http';
import { checkApp } from './utils';
import { removeSync } from 'fs-extra';

describe('Next.js Applications', () => {
  let proj: string;
  let originalEnv: string;
  let packageManager;

  beforeEach(() => {
    proj = newProject();
    packageManager = detectPackageManager(tmpProjPath());
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    cleanupProject();
  });

  it('should generate app + libs', async () => {
    const appName = uniq('app');
    const nextLib = uniq('nextlib');
    const jsLib = uniq('tslib');
    const buildableLib = uniq('buildablelib');

    runCLI(`generate @nrwl/next:app ${appName} --no-interactive --style=css`);
    runCLI(`generate @nrwl/next:lib ${nextLib} --no-interactive`);
    runCLI(`generate @nrwl/js:lib ${jsLib} --no-interactive`);
    runCLI(
      `generate @nrwl/js:lib ${buildableLib} --no-interactive --bundler=vite`
    );

    // Create file in public that should be copied to dist
    updateFile(`apps/${appName}/public/a/b.txt`, `Hello World!`);

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
          export function jsLib(): string {
            return 'Hello Nx';
          };

          // testing whether async-await code in Node / Next.js api routes works as expected
          export async function jsLibAsync() {
            return await Promise.resolve('hell0');
          }
          `
    );

    updateFile(
      `libs/${buildableLib}/src/lib/${buildableLib}.ts`,
      `
          export function buildableLib(): string {
            return 'Hello Buildable';
          };
          `
    );

    const mainPath = `apps/${appName}/pages/index.tsx`;
    const content = readFile(mainPath);

    updateFile(
      `apps/${appName}/pages/api/hello.ts`,
      `
          import { jsLibAsync } from '@${proj}/${jsLib}';

          export default async function handler(_, res) {
            const value = await jsLibAsync();
            res.send(value);
          }
        `
    );

    updateFile(
      mainPath,
      `
          import { jsLib } from '@${proj}/${jsLib}';
          import { buildableLib } from '@${proj}/${buildableLib}';
          /* eslint-disable */
          import dynamic from 'next/dynamic';

          const TestComponent = dynamic(
              () => import('@${proj}/${nextLib}').then(d => d.${capitalize(
        nextLib
      )})
            );
          ${content.replace(
            `</h2>`,
            `</h2>
                <div>
                  {jsLib()}
                  {buildableLib()}
                  <TestComponent />
                </div>
              `
          )}`
    );

    const e2eTestPath = `apps/${appName}-e2e/src/e2e/app.cy.ts`;
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

    // public and shared assets should both be copied to dist
    checkFilesExist(
      `dist/apps/${appName}/public/a/b.txt`,
      `dist/apps/${appName}/public/shared/ui/hello.txt`
    );

    // Check that `nx serve <app> --prod` works with previous production build (e.g. `nx build <app>`).
    const prodServePort = 4000;
    const prodServeProcess = await runCommandUntil(
      `run ${appName}:serve --prod --port=${prodServePort}`,
      (output) => {
        return output.includes(`localhost:${prodServePort}`);
      }
    );

    // Check that the output is self-contained (i.e. can run with its own package.json + node_modules)
    const distPath = joinPathFragments(tmpProjPath(), 'dist/apps', appName);
    const selfContainedPort = 3000;
    const pmc = getPackageManagerCommand();
    runCommand(`${pmc.install}`, {
      cwd: distPath,
    });
    runCLI(
      `generate @nrwl/workspace:run-commands serve-prod --project ${appName} --cwd=dist/apps/${appName} --command="npx next start --port=${selfContainedPort}"`
    );
    const selfContainedProcess = await runCommandUntil(
      `run ${appName}:serve-prod`,
      (output) => {
        return output.includes(`localhost:${selfContainedPort}`);
      }
    );

    prodServeProcess.kill();
    selfContainedProcess.kill();
    await killPort(prodServePort);
    await killPort(selfContainedPort);
  }, 300_000);

  it('should build and install pruned lock file', () => {
    const appName = uniq('app');
    runCLI(`generate @nrwl/next:app ${appName} --no-interactive --style=css`);

    const result = runCLI(`build ${appName} --generateLockfile=true`);
    expect(result).not.toMatch(/Graph is not consistent/);
    checkFilesExist(
      `dist/apps/${appName}/${packageManagerLockFile[packageManager]}`
    );
    runCommand(`${getPackageManagerCommand().ciInstall}`, {
      cwd: joinPathFragments(tmpProjPath(), 'dist/apps', appName),
    });
  }, 1_000_000);

  // TODO(jack): re-enable this test
  xit('should be able to serve with a proxy configuration', async () => {
    const appName = uniq('app');
    const jsLib = uniq('tslib');

    const port = 4200;

    runCLI(`generate @nrwl/next:app ${appName}`);
    runCLI(`generate @nrwl/js:lib ${jsLib} --no-interactive`);

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
      `libs/${jsLib}/src/lib/${jsLib}.ts`,
      `
          export function jsLib(): string {
            return process.env.NX_CUSTOM_VAR;
          };
          `
    );

    updateFile(
      `apps/${appName}/pages/index.tsx`,
      `
        import React from 'react';
        import { jsLib } from '@${proj}/${jsLib}';

        export const Index = ({ greeting }: any) => {
          return (
            <p>{jsLib()}</p>
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

    await killPorts();
  }, 300_000);

  it('should support custom next.config.js and output it in dist', async () => {
    const appName = uniq('app');

    runCLI(`generate @nrwl/next:app ${appName} --no-interactive --style=css`);

    updateFile(
      `apps/${appName}/next.config.js`,
      `
        const { withNx } = require('@nrwl/next/plugins/with-nx');
        const nextConfig = {
          nx: {
            svgr: false,
          },
          webpack: (config, context) => {
            // Make sure SVGR plugin is disabled if nx.svgr === false (see above)
            const found = config.module.rules.find(r => {
              if (!r.test || !r.test.test('test.svg')) return false;
              if (!r.oneOf || !r.oneOf.use) return false;
              return r.oneOf.use.some(rr => /svgr/.test(rr.loader));
            });
            if (found) throw new Error('Found SVGR plugin');

            console.log('NODE_ENV is', process.env.NODE_ENV);

            return config;
          }
        };

        module.exports = withNx(nextConfig);
      `
    );
    // deleting `NODE_ENV` value, so that it's `undefined`, and not `"test"`
    // by the time it reaches the build executor.
    // this simulates existing behaviour of running a next.js build executor via Nx
    delete process.env.NODE_ENV;
    const result = runCLI(`build ${appName}`);

    checkFilesExist(`dist/apps/${appName}/next.config.js`);
    expect(result).toContain('NODE_ENV is production');

    updateFile(
      `apps/${appName}/next.config.js`,
      `
        const { withNx } = require('@nrwl/next/plugins/with-nx');
        // Not including "nx" entry should still work.
        const nextConfig = {};

        module.exports = withNx(nextConfig);
      `
    );

    rmDist();
    runCLI(`build ${appName}`);

    checkFilesExist(`dist/apps/${appName}/next.config.js`);
  }, 300_000);

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
      `generate @nrwl/next:lib ${libName} --no-interactive --style=none --js`
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
  }, 300_000);

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
  }, 300_000);

  //TODO(caleb): Throwing error Cypress failed to verify that your server is running.
  it.skip('should allow using a custom server implementation', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nrwl/next:app ${appName} --style=css --no-interactive --custom-server`
    );

    checkFilesExist(`apps/${appName}/server/main.ts`);

    await checkApp(appName, {
      checkUnitTest: false,
      checkLint: false,
      checkE2E: true,
      checkExport: false,
    });
  }, 300_000);
});

function getData(port, path = ''): Promise<any> {
  return new Promise((resolve, reject) => {
    http
      .get(`http://localhost:${port}${path}`, (res) => {
        expect(res.statusCode).toEqual(200);
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.once('end', () => {
          resolve(data);
        });
      })
      .on('error', (err) => reject(err));
  });
}
