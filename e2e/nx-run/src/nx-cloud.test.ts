import { cleanupProject, newProject, runCLI } from '@nx/e2e/utils';

describe('Nx Cloud', () => {
  beforeAll(() =>
    newProject({
      unsetProjectNameAndRootFormat: false,
      packages: ['@nx/js'],
    })
  );

  const libName = 'test-lib';
  beforeAll(() => {
    runCLI('connect --no-interactive', {
      env: {
        NX_CLOUD_API: 'https://staging.nx.app',
      },
    });
    runCLI(`generate @nx/js:lib ${libName} --no-interactive`);
  });

  afterAll(() => cleanupProject());

  // Disabled due to flakiness on CI (NXP-423)
  // TODO: Re-enable once we we solve this in the light client.
  xit('should cache tests', async () => {
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
