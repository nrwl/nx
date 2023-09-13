import {
  cleanupProject,
  killPorts,
  newProject,
  runCLI,
  runE2ETests,
  uniq,
} from '@nx/e2e/utils';

describe('Vue Plugin', () => {
  let proj: string;

  beforeAll(() => {
    proj = newProject({
      unsetProjectNameAndRootFormat: false,
    });
  });

  afterAll(() => cleanupProject());

  it('should serve application in dev mode', async () => {
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

    if (runE2ETests()) {
      const e2eResults = runCLI(`e2e ${app}-e2e --no-watch`);
      expect(e2eResults).toContain('Successfully ran target e2e');
      expect(await killPorts()).toBeTruthy();
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
