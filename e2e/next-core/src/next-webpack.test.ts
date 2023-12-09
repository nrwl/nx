import {
  checkFilesExist,
  cleanupProject,
  newProject,
  rmDist,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { join } from 'path';

describe('Next.js Webpack', () => {
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

  it('should support custom webpack and run-commands using withNx', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --style=css --appDir=false`
    );

    updateFile(
      `apps/${appName}/next.config.js`,
      `
        const { withNx } = require('@nx/next');
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
        const { withNx } = require('@nx/next');
        // Not including "nx" entry should still work.
        const nextConfig = {};

        module.exports = withNx(nextConfig);
      `
    );
    rmDist();
    runCLI(`build ${appName}`);
    checkFilesExist(`dist/apps/${appName}/next.config.js`);

    // Make sure withNx works with run-commands.
    updateJson(join('apps', appName, 'project.json'), (json) => {
      json.targets.build = {
        command: 'npx next build',
        outputs: [`{projectRoot}/.next`],
        options: {
          cwd: `apps/${appName}`,
        },
      };
      return json;
    });
    expect(() => {
      runCLI(`build ${appName}`);
    }).not.toThrow();
    checkFilesExist(`dist/apps/${appName}/.next/build-manifest.json`);
  }, 300_000);
});
