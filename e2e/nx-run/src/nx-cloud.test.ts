import { cleanupProject, newProject, runCLI } from '@nx/e2e/utils';

describe('Nx Cloud', () => {
  beforeAll(() =>
    newProject({
      unsetProjectNameAndRootFormat: false,
    })
  );

  const libName = 'test-lib';
  beforeAll(() => {
    runCLI('connect --no-interactive', {
      env: {
        ...process.env,
        NX_CLOUD_API: 'https://staging.nx.app',
      },
    });
    runCLI(`generate @nx/js:lib ${libName} --no-interactive`);
  });

  afterAll(() => cleanupProject());

  it('should cache tests', async () => {
    // Should be able to view logs with Nx Cloud
    expect(runCLI(`test ${libName}`)).toContain(
      `View logs and investigate cache misses at https://staging.nx.app`
    );

    // Reset Local cache
    runCLI(`reset`);

    // Should be pull cache from Nx Cloud
    expect(runCLI(`test ${libName}`)).toContain(
      `Nx Cloud made it possible to reuse test-lib: https://staging.nx.app`
    );
  });
});
