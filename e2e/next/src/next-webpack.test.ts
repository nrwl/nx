import {
  checkFilesExist,
  cleanupProject,
  newProject,
  readFile,
  rmDist,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { join } from 'path';

describe('Next.js Webpack', () => {
  let proj: string;
  let originalEnv: string;

  beforeEach(() => {
    proj = newProject({
      packages: ['@nx/next', '@nx/jest', '@nx/playwright'],
    });
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    cleanupProject();
  });

  it('should support custom webpack and run-commands without config helpers', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --style=css --appDir=false`,
      {
        env: {
          NX_ADD_PLUGINS: 'false',
        },
      }
    );

    checkFilesExist(`${appName}/next.config.js`);
    const generatedConfig = readFile(`${appName}/next.config.js`);
    updateFile(
      `${appName}/next.config.js`,
      `${generatedConfig}
        const baseConfig = module.exports;
        /** @type {import('next').NextConfig['webpack']} */
        const configureWebpack = (config) => {
          console.log('NODE_ENV is', process.env.NODE_ENV);
          return config;
        };
        /**
         * @param {string} phase
         * @returns {import('next').NextConfig}
         */
        module.exports = (phase) => ({
          ...baseConfig(phase),
          webpack: configureWebpack,
        });
      `
    );
    // deleting `NODE_ENV` value, so that it's `undefined`, and not `"test"`
    // by the time it reaches the build executor.
    // this simulates existing behaviour of running a next.js build executor via Nx
    delete process.env.NODE_ENV;
    const result = runCLI(`build ${appName} --webpack`);

    checkFilesExist(`dist/${appName}/next.config.js`);
    expect(result).toContain('NODE_ENV is production');

    checkFilesExist(`dist/${appName}/.next/build-manifest.json`);
    updateFile(`${appName}/next.config.js`, generatedConfig);
    rmDist();
    runCLI(`build ${appName} --webpack`);
    checkFilesExist(`dist/${appName}/next.config.js`);

    checkFilesExist(`dist/${appName}/.next/build-manifest.json`);

    // Direct Next commands use the app's default output directory.
    updateJson(join(appName, 'project.json'), (json) => {
      json.targets.build = {
        command: 'npx next build',
        outputs: [`{projectRoot}/.next`],
        options: {
          cwd: `${appName}`,
        },
      };
      return json;
    });
    expect(() => {
      runCLI(`build ${appName} --webpack`);
    }).not.toThrow();
    checkFilesExist(`${appName}/.next/build-manifest.json`);
  }, 300_000);
});
