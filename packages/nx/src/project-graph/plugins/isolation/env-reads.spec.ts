import { withEnvReads } from './env-reads';

describe('withEnvReads', () => {
  const base = { SET: 'yes' } as NodeJS.ProcessEnv;

  it('reports the keys the load read, and whether they were set', async () => {
    const { result, envReads } = await withEnvReads(async () => {
      process.env.SET;
      process.env.UNSET;
      return 'loaded';
    }, base);

    expect(result).toBe('loaded');
    // Absence is part of the answer: a plugin that checks for a variable nobody
    // set behaves differently once somebody sets it.
    expect(envReads).toEqual({ SET: 'yes', UNSET: null });
  });

  it('counts an `in` check as a read', async () => {
    const { envReads } = await withEnvReads(async () => {
      'UNSET' in process.env;
      return null;
    }, base);

    expect(envReads).toEqual({ UNSET: null });
  });

  it('reports nothing observable when the load takes the whole environment', async () => {
    const { envReads } = await withEnvReads(async () => {
      ({ ...process.env });
      return null;
    }, base);

    // A record naming every variable would be invalidated by any of them, so
    // this plugin is left uncached rather than cached against everything.
    expect(envReads).toBeNull();
  });

  it('puts the real environment back, even when the load throws', async () => {
    const before = process.env;

    await expect(
      withEnvReads(async () => {
        throw new Error('plugin blew up');
      }, base)
    ).rejects.toThrow('plugin blew up');

    expect(process.env).toBe(before);
  });

  it('does not leave the proxy installed for later reads', async () => {
    await withEnvReads(async () => null, base);

    const { envReads } = await withEnvReads(async () => null, base);
    // Nothing read during the second load, so the first load's proxy is not
    // still recording into it.
    expect(envReads).toEqual({});
  });
});
