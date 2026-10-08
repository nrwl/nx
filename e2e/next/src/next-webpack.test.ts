import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

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

  it('should support custom webpack using withNx', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --style=css --appDir=false`
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
    // Unset so `next build` sets it, rather than inheriting jest's "test".
    delete process.env.NODE_ENV;
    const result = runCLI(`build ${appName} --webpack`);

    checkFilesExist(`${appName}/.next/build-manifest.json`);
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
    runCLI(`build ${appName} --webpack --skip-nx-cache`);
    checkFilesExist(`${appName}/.next/build-manifest.json`);
  }, 300_000);
});
