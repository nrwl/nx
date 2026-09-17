import { hashEnvValue, withEnvReads } from './env-reads';

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
    // set behaves differently once somebody sets it. Values are hashed, because
    // a load reads whatever its dependencies read and one of those, measured, is
    // `NX_CLOUD_ACCESS_TOKEN`.
    expect(envReads).toEqual({ SET: hashEnvValue('yes'), UNSET: null });
    expect(envReads.SET).not.toContain('yes');
  });

  it('keeps an unset variable distinct from one whose value says undefined', async () => {
    const { envReads } = await withEnvReads(
      async () => {
        process.env.SAYS_UNDEFINED;
        process.env.NOT_THERE;
        return null;
      },
      { SAYS_UNDEFINED: 'undefined' } as NodeJS.ProcessEnv
    );

    expect(envReads.SAYS_UNDEFINED).toBe(hashEnvValue('undefined'));
    expect(envReads.NOT_THERE).toBeNull();
    expect(envReads.SAYS_UNDEFINED).not.toBeNull();
  });

  it('leaves out the variables that say how the process was started', async () => {
    const { envReads } = await withEnvReads(
      async () => {
        process.env._;
        process.env.PWD;
        process.env.NX_DOTNET_DISABLE;
        return null;
      },
      { _: '/usr/bin/node', PWD: '/ws' } as NodeJS.ProcessEnv
    );

    // Recording those would invalidate every record on the next command run
    // from another directory or through another binary.
    expect(Object.keys(envReads)).toEqual(['NX_DOTNET_DISABLE']);
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
