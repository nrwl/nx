import { getInstalledNextVersionRuntime } from './runtime-version-utils';

describe('getInstalledNextVersionRuntime', () => {
  // Integration test - tests the function in the actual environment
  // Since Next.js is installed in this monorepo, we test that it returns a valid version
  it('should return a number when called in an environment with Next.js', () => {
    const result = getInstalledNextVersionRuntime();

    // In this Nx monorepo, Next.js should be installed
    // We don't assert the exact version as it may change, but it should be a valid number
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(14); // Should be at least version 14
  });

  it('should return null or a number (never undefined)', () => {
    const result = getInstalledNextVersionRuntime();

    expect(result === null || typeof result === 'number').toBe(true);
  });
});
