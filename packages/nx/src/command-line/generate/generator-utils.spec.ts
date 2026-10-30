import { describe, expect, it, vi } from 'vitest';
import { runGeneratorCallback } from './generator-utils';

describe('runGeneratorCallback', () => {
  it('should run a returned callback', async () => {
    const callback = vi.fn();
    await runGeneratorCallback(callback);
    expect(callback).toHaveBeenCalledOnce();
  });

  it('should run the callback of a sync generator result', async () => {
    const callback = vi.fn();
    await runGeneratorCallback({ callback, outOfSyncMessage: 'out of sync' });
    expect(callback).toHaveBeenCalledOnce();
  });

  it('should accept a sync generator result without a callback', async () => {
    await expect(
      runGeneratorCallback({ outOfSyncMessage: 'out of sync' })
    ).resolves.toBeUndefined();
  });

  it('should accept no result', async () => {
    await expect(runGeneratorCallback(undefined)).resolves.toBeUndefined();
  });
});
