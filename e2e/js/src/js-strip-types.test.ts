import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  uniq,
} from '@nx/e2e-utils';

const TEN_MINS_MS = 600_000;

describe('native Node.js TypeScript support (NX_PREFER_NODE_STRIP_TYPES)', () => {
  beforeAll(() => {
    newProject({
      name: uniq('strip-types'),
      packages: [
        '@nx/js',
        '@nx/react',
        '@nx/playwright',
        '@nx/cypress',
        '@nx/web',
      ],
    });
  });

  afterAll(() => cleanupProject());

  describe('project graph computation with TypeScript configs', () => {
    it(
      'should compute project graph when loading jest.config.cts',
      () => {
        const lib = uniq('lib');
        runCLI(
          `generate @nx/js:lib ${lib} --unitTestRunner=jest --no-interactive`
        );

        checkFilesExist(`${lib}/jest.config.cts`);

        // Run nx report with NX_PREFER_NODE_STRIP_TYPES=true
        // This forces the use of Node.js native type stripping if available
        const result = runCLI('report', {
          env: { NX_PREFER_NODE_STRIP_TYPES: 'true' },
        });

        expect(result).toContain('nx');
      },
      TEN_MINS_MS
    );

    it(
      'should compute project graph when loading cypress.config.ts',
      () => {
        const app = uniq('app');
        runCLI(
          `generate @nx/react:app apps/${app} --e2eTestRunner=cypress --linter=eslint --no-interactive`
        );

        checkFilesExist(`apps/${app}-e2e/cypress.config.ts`);

        // Run nx report with NX_PREFER_NODE_STRIP_TYPES=true
        const result = runCLI('report', {
          env: { NX_PREFER_NODE_STRIP_TYPES: 'true' },
        });

        expect(result).toContain('nx');
      },
      TEN_MINS_MS
    );

    it(
      'should compute project graph when loading playwright.config.ts',
      () => {
        const app = uniq('app');
        runCLI(
          `generate @nx/web:app ${app} --unitTestRunner=none --bundler=vite --e2eTestRunner=none --style=css --no-interactive`
        );
        runCLI(
          `generate @nx/playwright:configuration --project ${app} --webServerCommand="echo test" --webServerAddress="http://localhost:4200"`
        );

        checkFilesExist(`${app}/playwright.config.ts`);

        // Run nx report with NX_PREFER_NODE_STRIP_TYPES=true
        const result = runCLI('report', {
          env: { NX_PREFER_NODE_STRIP_TYPES: 'true' },
        });

        expect(result).toContain('nx');
      },
      TEN_MINS_MS
    );
  });
});
