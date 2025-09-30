import { checkFilesExist, runCLI, uniq } from '@nx/e2e-utils';
import {
  setupNextTest,
  resetNextEnv,
  cleanupNextTest,
  NextTestSetup,
} from './next-setup';

describe('Next.js Applications - Custom Server', () => {
  let setup: NextTestSetup;

  beforeAll(() => {
    setup = setupNextTest();
  });

  beforeEach(() => {
    resetNextEnv(setup);
  });

  afterEach(() => {
    resetNextEnv(setup);
  });

  afterAll(() => cleanupNextTest());

  it('should support --custom-server flag (swc)', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --custom-server --linter=eslint --unitTestRunner=jest`
    );

    // Check for custom server files added to source
    checkFilesExist(`${appName}/server/main.ts`);
    checkFilesExist(`${appName}/.server.swcrc`);

    const result = runCLI(`build ${appName}`);

    checkFilesExist(`dist/${appName}-server/server/main.js`);

    expect(result).toContain(
      `Successfully ran target build for project ${appName}`
    );
  }, 300_000);

  it('should support --custom-server flag (tsc)', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --swc=false --no-interactive --custom-server --linter=eslint --unitTestRunner=jest`
    );

    checkFilesExist(`${appName}/server/main.ts`);

    const result = runCLI(`build ${appName}`);

    checkFilesExist(`dist/${appName}-server/server/main.js`);

    expect(result).toContain(
      `Successfully ran target build for project ${appName}`
    );
  }, 300_000);
});
