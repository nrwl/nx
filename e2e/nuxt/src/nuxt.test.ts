import {
  cleanupProject,
  killPorts,
  newProject,
  runCLI,
  uniq,
} from '@nx/e2e/utils';

describe('Vue Plugin', () => {
  let proj: string;
  const app = uniq('app');

  beforeAll(() => {
    proj = newProject({
      unsetProjectNameAndRootFormat: false,
    });
    runCLI(
      `generate @nx/vue:app ${app} --unitTestRunner=vitest --e2eTestRunner=playwright`
    );
  });

  afterAll(() => {
    killPorts();
    cleanupProject();
  });

  it('should build application', async () => {
    const app = uniq('app');

    runCLI(`generate @nx/nuxt:app ${app} --unitTestRunner=none`);

    const result = runCLI(`build ${app}`);
    expect(result).toContain(
      `Successfully ran target build for project ${app}`
    );
  });
});
