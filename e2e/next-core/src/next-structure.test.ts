import { mkdirSync, removeSync } from 'fs-extra';
import { capitalize } from '@nx/devkit/src/utils/string-utils';
import { checkApp } from './utils';
import {
  checkFilesExist,
  cleanupProject,
  isNotWindows,
  killPort,
  newProject,
  readFile,
  runCLI,
  runCommandUntil,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { join } from 'path';

describe('Next.js Apps Libs', () => {
  let proj: string;
  let originalEnv: string;

  beforeEach(() => {
    proj = newProject();
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    cleanupProject();
  });

  it('should generate app + libs', async () => {
    // Remove apps/libs folder and use packages.
    // Allows us to test other integrated monorepo setup that had a regression.
    // See: https://github.com/nrwl/nx/issues/16658
    removeSync(`${tmpProjPath()}/libs`);
    removeSync(`${tmpProjPath()}/apps`);
    mkdirSync(`${tmpProjPath()}/packages`);

    const appName = uniq('app');
    const nextLib = uniq('nextlib');
    const jsLib = uniq('tslib');
    const buildableLib = uniq('buildablelib');

    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --style=css --appDir=false`
    );
    runCLI(`generate @nx/next:lib ${nextLib} --no-interactive`);
    runCLI(`generate @nx/js:lib ${jsLib} --no-interactive`);
    runCLI(
      `generate @nx/js:lib ${buildableLib} --no-interactive --bundler=vite`
    );

    // Create file in public that should be copied to dist
    updateFile(`packages/${appName}/public/a/b.txt`, `Hello World!`);

    // Additional assets that should be copied to dist
    const sharedLib = uniq('sharedLib');
    updateJson(join('packages', appName, 'project.json'), (json) => {
      json.targets.build.options.assets = [
        {
          glob: '**/*',
          input: `packages/${sharedLib}/src/assets`,
          output: 'shared/ui',
        },
      ];
      return json;
    });
    updateFile(`packages/${sharedLib}/src/assets/hello.txt`, 'Hello World!');

    // create a css file in node_modules so that it can be imported in a lib
    // to test that it works as expected
    updateFile(
      'node_modules/@nx/next/test-styles.css',
      'h1 { background-color: red; }'
    );

    updateFile(
      `packages/${jsLib}/src/lib/${jsLib}.ts`,
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
      `packages/${buildableLib}/src/lib/${buildableLib}.ts`,
      `
              export function buildableLib(): string {
                return 'Hello Buildable';
              };
              `
    );

    const mainPath = `packages/${appName}/src/pages/index.tsx`;
    const content = readFile(mainPath);

    updateFile(
      `packages/${appName}/src/pages/api/hello.ts`,
      `
              import { jsLibAsync } from '@${proj}/${jsLib}';
    
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              export default async function handler(_: any, res: any) {
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

    const e2eTestPath = `packages/${appName}-e2e/src/e2e/app.cy.ts`;
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
      appsDir: 'packages',
    });

    // public and shared assets should both be copied to dist
    checkFilesExist(
      `dist/packages/${appName}/public/a/b.txt`,
      `dist/packages/${appName}/public/shared/ui/hello.txt`
    );

    // Check that compiled next config does not contain bad imports
    const nextConfigPath = `dist/packages/${appName}/next.config.js`;
    expect(nextConfigPath).not.toContain(`require("../`); // missing relative paths
    expect(nextConfigPath).not.toContain(`require("nx/`); // dev-only packages
    expect(nextConfigPath).not.toContain(`require("@nx/`); // dev-only packages

    // Check that `nx serve <app> --prod` works with previous production build (e.g. `nx build <app>`).
    const prodServePort = 4001;
    const prodServeProcess = await runCommandUntil(
      `run ${appName}:serve --prod --port=${prodServePort}`,
      (output) => {
        return output.includes(`localhost:${prodServePort}`);
      }
    );

    // Check that the output is self-contained (i.e. can run with its own package.json + node_modules)
    const selfContainedPort = 3000;
    runCLI(
      `generate @nx/workspace:run-commands serve-prod --project ${appName} --cwd=dist/packages/${appName} --command="npx next start --port=${selfContainedPort}"`
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
  }, 600_000);
});
