import { hashEnvReads, withEnvReads } from './env-reads';

describe('withEnvReads', () => {
  const base = { SET: 'yes' } as NodeJS.ProcessEnv;

  it('reports the keys the load read', async () => {
    const { result, envReads } = await withEnvReads(async () => {
      process.env.SET;
      process.env.UNSET;
      return 'loaded';
    }, base);

    expect(result).toBe('loaded');
    expect(envReads.keys).toEqual(['SET', 'UNSET']);
    expect(envReads.hash).toBe(hashEnvReads(['SET', 'UNSET'], base));
  });

  it('keeps the values out of what it stores', async () => {
    // A load reads whatever its dependencies read, and one of those, measured
    // on this repository, is `NX_CLOUD_ACCESS_TOKEN`. One hash over the whole
    // set also means no single value can be brute forced on its own.
    const { envReads } = await withEnvReads(
      async () => {
        process.env.TOKEN;
        return null;
      },
      { TOKEN: 'sekrit' } as NodeJS.ProcessEnv
    );

    expect(JSON.stringify(envReads)).not.toContain('sekrit');
  });

  it('changes when any one value changes', async () => {
    const read = async (env: NodeJS.ProcessEnv) =>
      (
        await withEnvReads(async () => {
          process.env.A;
          process.env.B;
          return null;
        }, env)
      ).envReads.hash;

    const original = await read({ A: '1', B: '2' } as NodeJS.ProcessEnv);

    expect(await read({ A: '1', B: '2' } as NodeJS.ProcessEnv)).toBe(original);
    expect(await read({ A: '9', B: '2' } as NodeJS.ProcessEnv)).not.toBe(
      original
    );
    expect(await read({ A: '1', B: '9' } as NodeJS.ProcessEnv)).not.toBe(
      original
    );
    // Each value is hashed against its own key, so swapping two of them is a
    // change rather than a wash.
    expect(await read({ A: '2', B: '1' } as NodeJS.ProcessEnv)).not.toBe(
      original
    );
  });

  it('keeps an unset variable distinct from one whose value says undefined', async () => {
    // Absence is part of the answer. `@nx/dotnet` exports no hooks when
    // `NX_DOTNET_DISABLE` is set, and its files are identical either way.
    const unset = hashEnvReads(['X'], {} as NodeJS.ProcessEnv);

    expect(unset).not.toBe(
      hashEnvReads(['X'], { X: 'undefined' } as NodeJS.ProcessEnv)
    );
    expect(unset).not.toBe(hashEnvReads(['X'], { X: '' } as NodeJS.ProcessEnv));
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
    expect(envReads.keys).toEqual(['NX_DOTNET_DISABLE']);
  });

  it('leaves out the variables Nx writes for itself', async () => {
    const { envReads } = await withEnvReads(
      async () => {
        process.env.NX_TUI;
        process.env.NX_VERBOSE_LOGGING;
        process.env.NX_DOTNET_DISABLE;
        return null;
      },
      { NX_TUI: 'true' } as NodeJS.ProcessEnv
    );

    // Nx decides `NX_TUI` per command from the arguments and the terminal, and
    // `@nx/eslint`'s and `@nx/jest`'s loads both read it without asking, by
    // reaching `is-tui-enabled.ts`. Recording it would miss every record on the
    // next command of a different shape.
    expect(envReads.keys).toEqual(['NX_DOTNET_DISABLE']);
  });

  it('counts an `in` check as a read', async () => {
    const { envReads } = await withEnvReads(async () => {
      'UNSET' in process.env;
      return null;
    }, base);

    expect(envReads.keys).toEqual(['UNSET']);
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
    expect(envReads.keys).toEqual([]);
  });
});
