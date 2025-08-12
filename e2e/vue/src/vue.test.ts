import {
  cleanupProject,
  killPorts,
  newProject,
  runCLI,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

describe('Vue Plugin', () => {
  let proj: string;

  beforeAll(() => {
    proj = newProject({
      packages: ['@nx/vue'],
    });
  });

  afterAll(() => cleanupProject());

  it('should serve application in dev mode vite config', async () => {
    const app = uniq('app');

    runCLI(
      `generate @nx/vue:app ${app} --unitTestRunner=vitest --e2eTestRunner=playwright`
    );
    let result = runCLI(`test ${app}`);
    expect(result).toContain(`Successfully ran target test for project ${app}`);

    result = runCLI(`build ${app}`);
    expect(result).toContain(
      `Successfully ran target build for project ${app}`
    );

    if (runE2ETests('playwright')) {
      const availablePort = await getAvailablePort();

      updateFile(`${app}-e2e/playwright.config.ts`, (content) => {
        return content
          .replace(
            /const baseURL = process\.env\['BASE_URL'\] \|\| '[^']*';/,
            `const baseURL = process.env['BASE_URL'] || 'http://localhost:${availablePort}';`
          )
          .replace(/url: '[^']*'/, `url: 'http://localhost:${availablePort}'`);
      });

      updateFile(`${app}/vite.config.ts`, (content) => {
        return content.replace(
          /preview:\s*{[^}]*}/,
          `preview: {
    port: ${availablePort},
    host: 'localhost',
  }`
        );
      });

      const e2eResults = runCLI(`e2e ${app}-e2e`);
      expect(e2eResults).toContain('Successfully ran target e2e');
      expect(await killPorts(availablePort)).toBeTruthy();
    }
  }, 200_000);

  it('should serve application in dev mode with rsbuild', async () => {
    const app = uniq('app');

    runCLI(
      `generate @nx/vue:app ${app} --bundler=rsbuild --unitTestRunner=vitest --e2eTestRunner=playwright`
    );
    let result = runCLI(`test ${app}`);
    expect(result).toContain(`Successfully ran target test for project ${app}`);

    result = runCLI(`build ${app}`);
    expect(result).toContain(
      `Successfully ran target build for project ${app}`
    );

    if (runE2ETests('playwright')) {
      const availablePort = await getAvailablePort();

      updateFile(`${app}-e2e/playwright.config.ts`, (content) => {
        return content
          .replace(
            /const baseURL = process\.env\['BASE_URL'\] \|\| '[^']*';/,
            `const baseURL = process.env['BASE_URL'] || 'http://localhost:${availablePort}';`
          )
          .replace(/url: '[^']*'/, `url: 'http://localhost:${availablePort}'`);
      });

      updateFile(`${app}/rsbuild.config.ts`, (content) => {
        return content.replace(
          /server:\s*{[^}]*}/,
          `server: {
    port: ${availablePort},
  }`
        );
      });

      const e2eResults = runCLI(`e2e ${app}-e2e`);
      expect(e2eResults).toContain('Successfully ran target e2e');
      expect(await killPorts(availablePort)).toBeTruthy();
    }
  }, 200_000);

  it('should build library', async () => {
    const lib = uniq('lib');

    runCLI(
      `generate @nx/vue:lib ${lib} --bundler=vite --unitTestRunner=vitest`
    );

    const result = runCLI(`build ${lib}`);
    expect(result).toContain(
      `Successfully ran target build for project ${lib}`
    );
  });
});

async function getAvailablePort(): Promise<number> {
  const net = require('net');

  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);

    server.listen(0, () => {
      const addressInfo = server.address();
      if (!addressInfo) {
        reject(new Error('Failed to get server address'));
        return;
      }
      const port = addressInfo.port;
      server.close(() => {
        resolve(port);
      });
    });
  });
}
