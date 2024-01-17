import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  killPort,
  killPorts,
  newProject,
  readFile,
  runCLI,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e/utils';
import * as http from 'http';
import { checkApp } from './utils';

describe('Next.js Applications', () => {
  let proj: string;
  let originalEnv: string;

  beforeAll(() => {
    proj = newProject();
  });
  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  afterAll(() => cleanupProject());

  it('should support generating projects with the new name and root format', () => {
    const appName = uniq('app1');
    const libName = uniq('@my-org/lib1');

    runCLI(
      `generate @nx/next:app ${appName} --project-name-and-root-format=as-provided --no-interactive`
    );

    // check files are generated without the layout directory ("apps/") and
    // using the project name as the directory when no directory is provided
    checkFilesExist(`${appName}/app/page.tsx`);
    // check build works
    expect(runCLI(`build ${appName}`)).toContain(
      `Successfully ran target build for project ${appName}`
    );
    // check tests pass
    const appTestResult = runCLI(`test ${appName}`);
    expect(appTestResult).toContain(
      `Successfully ran target test for project ${appName}`
    );

    // assert scoped project names are not supported when --project-name-and-root-format=derived
    expect(() =>
      runCLI(
        `generate @nx/next:lib ${libName} --buildable --project-name-and-root-format=derived --no-interactive`
      )
    ).toThrow();

    runCLI(
      `generate @nx/next:lib ${libName} --buildable --project-name-and-root-format=as-provided --no-interactive`
    );

    // check files are generated without the layout directory ("libs/") and
    // using the project name as the directory when no directory is provided
    checkFilesExist(`${libName}/src/index.ts`);
    // check build works
    expect(runCLI(`build ${libName}`)).toContain(
      `Successfully ran target build for project ${libName}`
    );
  }, 600_000);

  it('should build app and .next artifacts at the outputPath if provided by the CLI', () => {
    const appName = uniq('app');
    runCLI(`generate @nx/next:app ${appName} --no-interactive --style=css`);

    runCLI(`build ${appName} --outputPath="dist/foo"`);

    checkFilesExist('dist/foo/package.json');
    checkFilesExist('dist/foo/next.config.js');
    // Next Files
    checkFilesExist('dist/foo/.next/package.json');
    checkFilesExist('dist/foo/.next/build-manifest.json');
  }, 600_000);

  // TODO(jack): re-enable this test
  xit('should be able to serve with a proxy configuration', async () => {
    const appName = uniq('app');
    const jsLib = uniq('tslib');

    const port = 4200;

    runCLI(`generate @nx/next:app ${appName} --appDir=false`);
    runCLI(`generate @nx/js:lib ${jsLib} --no-interactive`);

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
        export default (_req: any, res: any) => {
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

    await killPort(port);
    await killPorts();
  }, 300_000);

  it('should build in dev mode without errors', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --style=css --appDir=false`
    );

    checkFilesDoNotExist(`apps/${appName}/.next/build-manifest.json`);
    checkFilesDoNotExist(`apps/${appName}/.nx-helpers/with-nx.js`);

    expect(() => {
      runCLI(`build ${appName} --configuration=development`);
    }).not.toThrow();
  }, 300_000);

  it('should support --js flag', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --js --appDir=false`
    );

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
      `generate @nx/next:lib ${libName} --no-interactive --style=none --js`
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

    runCLI(`generate @nx/next:app ${appName} --no-interactive --no-swc`);

    // Next.js enables SWC when custom .babelrc is not provided.
    checkFilesExist(`apps/${appName}/.babelrc`);

    await checkApp(appName, {
      checkUnitTest: false,
      checkLint: false,
      checkE2E: false,
      checkExport: false,
    });
  }, 300_000);

  //TODO(caleb): Throwing error Cypress failed to verify that your server is running.
  it.skip('should allow using a custom server implementation', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --style=css --no-interactive --custom-server`
    );

    checkFilesExist(`apps/${appName}/server/main.ts`);

    await checkApp(appName, {
      checkUnitTest: false,
      checkLint: false,
      checkE2E: true,
      checkExport: false,
    });
  }, 300_000);

  it('should copy relative modules needed by the next.config.js file', async () => {
    const appName = uniq('app');

    runCLI(`generate @nx/next:app ${appName} --style=css --no-interactive`);

    updateFile(`apps/${appName}/redirects.js`, 'module.exports = [];');
    updateFile(
      `apps/${appName}/nested/headers.js`,
      `module.exports = require('./headers-2');`
    );
    updateFile(`apps/${appName}/nested/headers-2.js`, 'module.exports = [];');
    updateFile(`apps/${appName}/next.config.js`, (content) => {
      return `const redirects = require('./redirects');\nconst headers = require('./nested/headers.js');\n${content}`;
    });

    runCLI(`build ${appName}`);
    checkFilesExist(`dist/apps/${appName}/redirects.js`);
    checkFilesExist(`dist/apps/${appName}/nested/headers.js`);
    checkFilesExist(`dist/apps/${appName}/nested/headers-2.js`);
  }, 120_000);

  it('should support --turbo to enable Turbopack', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --style=css --appDir --no-interactive`
    );

    // add a new target to project.json to run with turbo enabled
    updateFile(`apps/${appName}/project.json`, (content) => {
      const json = JSON.parse(content);
      const updateJson = {
        ...json,
        targets: {
          ...json.targets,
          turbo: {
            executor: '@nx/next:server',
            defaultConfiguration: 'development',
            options: {
              buildTarget: `${appName}:build`,
              dev: true,
              turbo: true,
            },
            configurations: {
              development: {
                buildTarget: `${appName}:build:development`,
                dev: true,
                turbo: true,
              },
            },
          },
        },
      };
      return JSON.stringify(updateJson, null, 2);
    });

    // update cypress to use the new target
    updateFile(`apps/${appName}-e2e/project.json`, (content) => {
      const json = JSON.parse(content);
      const updatedJson = {
        ...json,
        targets: {
          ...json.targets,
          e2e: {
            ...json.targets.e2e,
            executor: '@nx/cypress:cypress',
            options: {
              ...json.targets.e2e.options,
              devServerTarget: `${appName}:turbo`,
            },
            configurations: {},
          },
        },
      };
      return JSON.stringify(updatedJson, null, 2);
    });

    if (runE2ETests()) {
      const e2eResult = runCLI(`e2e ${appName}-e2e --verbose`);
      expect(e2eResult).toContain('All specs passed!');
    }
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
