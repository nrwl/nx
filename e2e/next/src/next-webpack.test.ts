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

  it('should support a custom webpack function without config helpers', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --style=css --appDir=false`
    );

    checkFilesExist(`${appName}/next.config.js`);
    updateFile(
      `${appName}/next.config.js`,
      `/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    console.log('NODE_ENV is', process.env.NODE_ENV);
    return config;
  },
};

module.exports = nextConfig;
`
    );
    // Unset so `next build` sets it, rather than inheriting jest's "test".
    delete process.env.NODE_ENV;
    const result = runCLI(`build ${appName} --webpack`);

    checkFilesExist(`${appName}/.next/build-manifest.json`);
    expect(result).toContain('NODE_ENV is production');
  }, 300_000);
});
