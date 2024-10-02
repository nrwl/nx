import { cleanupProject, newProject, runCLI, uniq } from '@nx/e2e/utils';

describe('Vue Plugin (legacy)', () => {
  let proj: string;

  beforeAll(() => {
    proj = newProject({
      packages: ['@nx/vue'],
    });
  });

  afterAll(() => cleanupProject());

  it('should serve application in dev mode', async () => {
    const app = uniq('app');

    runCLI(
      `generate @nx/vue:app ${app} --unitTestRunner=vitest --e2eTestRunner=playwright`,
      { env: { NX_ADD_PLUGINS: 'false' } }
    );
    let result = runCLI(`test ${app}`);
    expect(result).toContain(`Successfully ran target test for project ${app}`);

    result = runCLI(`build ${app}`);
    expect(result).toContain(
      `Successfully ran target build for project ${app}`
    );
  }, 200_000);

  it('should build library', async () => {
    const lib = uniq('lib');

    runCLI(
      `generate @nx/vue:lib ${lib} --bundler=vite --unitTestRunner=vitest`,

      { env: { NX_ADD_PLUGINS: 'false' } }
    );

    const result = runCLI(`build ${lib}`);
    expect(result).toContain(
      `Successfully ran target build for project ${lib}`
    );
  });
});
