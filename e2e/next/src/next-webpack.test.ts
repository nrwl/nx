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
    proj = newProject({
      packages: ['@nx/next'],
    });
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    cleanupProject();
  });

  it('should support custom webpack and run-commands using withNx', async () => {
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
    updateFile(
      `${appName}/next.config.js`,
      `
        const { withNx } = require('@nx/next');
        const nextConfig = {
          nx: {
            svgr: false,
          },
          webpack: (config, context) => {
            // Make sure SVGR plugin is disabled if nx.svgr === false (see above)
            const found = config.module.rules.find((rule) => {
              // Check if the rule is for SVG files
              if (!/\.(svg)$/i.test('test.svg')) return false;
        
              // Check if the rule has a 'oneOf' structure
              if (!rule.oneOf || !Array.isArray(rule.oneOf)) return false;
        
              // Check each item in 'oneOf' for SVGR loader
              return rule.oneOf.some((oneOfRule) => {
                if (!oneOfRule.use) return false;
                // 'use' might be an object or an array, ensure it's an array for consistency
                const uses = Array.isArray(oneOfRule.use)
                  ? oneOfRule.use
                  : [oneOfRule.use];
                  return uses.some(use => {
                    if (typeof use.loader !== 'string') return false;
                    
                    const svgrRegex = new RegExp('@svgr/webpack');
                    return svgrRegex.test(use.loader);
                  });
              });
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

    checkFilesExist(`dist/${appName}/next.config.js`);
    expect(result).toContain('NODE_ENV is production');

    updateFile(
      `${appName}/next.config.js`,
      `
        const { withNx } = require('@nx/next');
        // Not including "nx" entry should still work.
        const nextConfig = {};

        module.exports = withNx(nextConfig);
      `
    );
    rmDist();
    runCLI(`build ${appName}`);
    checkFilesExist(`dist/${appName}/next.config.js`);

    // Make sure withNx works with run-commands.
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
      runCLI(`build ${appName}`);
    }).not.toThrow();
    checkFilesExist(`dist/${appName}/.next/build-manifest.json`);
  }, 300_000);
});
