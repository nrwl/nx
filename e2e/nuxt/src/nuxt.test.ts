import {
  cleanupProject,
  killPorts,
  newProject,
  runCLI,
  uniq,
} from '@nx/e2e/utils';

describe('Nuxt Plugin', () => {
  let proj: string;

  beforeAll(() => {
    proj = newProject({
      unsetProjectNameAndRootFormat: false,
    });
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
