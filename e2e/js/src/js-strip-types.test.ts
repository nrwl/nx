import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

const TEN_MINS_MS = 600_000;

// Native Node.js TypeScript support is on by default in v23 - no env var needed.
// NX_PREFER_NODE_STRIP_TYPES=false is the opt-out.
describe('native Node.js TypeScript support', () => {
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

        const result = runCLI('report');

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

        const result = runCLI('report');

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

        const result = runCLI('report');

        expect(result).toContain('nx');
      },
      TEN_MINS_MS
    );
  });

  describe('fallback to swc/ts-node when native strip cannot handle a config', () => {
    it(
      'should fall back to swc/ts-node when a TS config uses an enum',
      () => {
        const lib = uniq('lib');
        runCLI(
          `generate @nx/js:lib ${lib} --unitTestRunner=jest --no-interactive`
        );

        // enum is not supported by Node native type stripping - must trigger fallback
        updateFile(
          `${lib}/jest.config.cts`,
          `enum Mode { Standard = 'standard' }
const mode: Mode = Mode.Standard;
module.exports = { displayName: '${lib}', mode };
`
        );

        // Daemon owns project graph load - disable so fallback log lands in CLI stderr
        // instead of .nx/workspace-data/d/daemon.log. redirectStderr merges stderr
        // into the captured result.
        const result = runCLI('report', {
          env: { NX_VERBOSE_LOGGING: 'true' },
          daemon: false,
          redirectStderr: true,
        });

        expect(result).toContain('nx');
        expect(result).toContain('Native Node.js TypeScript stripping failed');
      },
      TEN_MINS_MS
    );

    it(
      'should fall back to swc/ts-node when a TS config uses an extensionless relative import',
      () => {
        const lib = uniq('lib');
        runCLI(
          `generate @nx/js:lib ${lib} --unitTestRunner=jest --no-interactive`
        );

        // Adjacent helper file the config imports without an extension.
        // Node's native resolver doesn't add `.ts`, so this throws
        // ERR_MODULE_NOT_FOUND under strip and tsconfig-paths can't fix it -
        // the loader must escalate to swc/ts-node.
        updateFile(
          `${lib}/jest-helpers.ts`,
          `export const displayName = '${lib}';\n`
        );
        updateFile(
          `${lib}/jest.config.cts`,
          `import { displayName } from './jest-helpers';
module.exports = { displayName };
`
        );

        const result = runCLI('report', {
          env: { NX_VERBOSE_LOGGING: 'true' },
          daemon: false,
          redirectStderr: true,
        });

        expect(result).toContain('nx');
        expect(result).toContain(
          'Module not found after tsconfig-paths; falling back to swc/ts-node'
        );
      },
      TEN_MINS_MS
    );
  });
});
