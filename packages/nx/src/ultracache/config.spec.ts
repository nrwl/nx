import type { Task } from '../config/task-graph';
import {
  applyDefaultUltracacheMode,
  getDefaultUltracacheMode,
  ultracacheEnv,
  isUltracacheConfigurationFetchEnabled,
} from './config';

describe('workspace Ultracache defaults', () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(['on', 'warn', 'error', 'off'] as const)(
    'resolves %s without changing the recording-fetch gate',
    (mode) => {
      vi.stubEnv('CI', 'true');
      vi.stubEnv('NX_CLOUD_ULTRACACHE_MODE', mode);
      expect(getDefaultUltracacheMode()).toBe(mode);
      const env = ultracacheEnv({
        NX_CLOUD_ULTRACACHE_MODE: mode,
        NX_CLOUD_USE_ULTRACACHE: 'true',
      });
      expect(getDefaultUltracacheMode(env)).toBe(mode);
      expect(
        isUltracacheConfigurationFetchEnabled({ nxCloudId: 'id' }, {}, env)
      ).toBe(true);
      expect(
        isUltracacheConfigurationFetchEnabled(
          { nxCloudId: 'id' },
          {},
          {
            ...env,
            NX_CLOUD_USE_ULTRACACHE: undefined,
          }
        )
      ).toBe(false);
    }
  );

  it.each([undefined, '', 'WARNING', 'STRICT', 'ON', 'true', 'unknown'])(
    'preserves older behavior for an absent or invalid mode (%s)',
    (mode) => {
      const task = { ultracache: undefined } as Task;
      const defaultMode = getDefaultUltracacheMode({
        NX_CLOUD_ULTRACACHE_MODE: mode,
      });
      applyDefaultUltracacheMode([task], defaultMode);
      expect(defaultMode).toBeUndefined();
      expect(task.ultracache).toBeUndefined();
    }
  );

  it.each(['on', 'warn', 'error', 'off'] as const)(
    'fills missing modes with %s while preserving explicit overrides and options',
    (mode) => {
      const options = { ignoreReads: ['tmp/**'], collectStats: true };
      const tasks = [
        {},
        { ultracache: options },
        ...(['on', 'warn', 'error', 'off'] as const).map((mode) => ({
          ultracache: { ...options, mode },
        })),
      ] as Task[];
      const explicit = tasks.slice(2).map((task) => task.ultracache);
      applyDefaultUltracacheMode(tasks, mode);
      expect(tasks[0].ultracache).toEqual({ mode });
      expect(tasks[1].ultracache).toEqual({ ...options, mode });
      expect(options).not.toHaveProperty('mode');
      for (const [i, settings] of explicit.entries()) {
        expect(tasks[i + 2].ultracache).toBe(settings);
      }
    }
  );
});

describe('isUltracacheConfigurationFetchEnabled', () => {
  const connected = { nxCloudId: 'id' } as any;
  const optedIn = { NX_CLOUD_USE_ULTRACACHE: 'true' };

  beforeEach(() => vi.stubEnv('CI', 'true'));
  afterEach(() => vi.unstubAllEnvs());

  it('is on when a run in a connected workspace opts in', () => {
    expect(isUltracacheConfigurationFetchEnabled(connected, {}, optedIn)).toBe(
      true
    );
  });

  // Connecting a workspace to Nx Cloud is not the opt-in: a run that says
  // nothing hashes exactly as it does today.
  it('is off until then, whatever else the env says', () => {
    for (const env of [
      {},
      { NX_CLOUD_USE_ULTRACACHE: '' },
      { NX_CLOUD_USE_ULTRACACHE: 'false' },
      { NX_CLOUD_USE_ULTRACACHE: '1' },
      { NX_CLOUD_USE_ULTRACACHE: 'TRUE' },
      // The pre-release names are gone.
      { NX_IO_SNAPSHOTS: 'true', NX_CLOUD_USE_IO_SNAPSHOTS: 'true' } as any,
    ]) {
      expect(isUltracacheConfigurationFetchEnabled(connected, {}, env)).toBe(
        false
      );
    }
  });

  it('is off outside CI, opt-in or not', () => {
    vi.stubEnv('CI', 'false');
    expect(isUltracacheConfigurationFetchEnabled(connected, {}, optedIn)).toBe(
      false
    );
  });

  it('is off in a workspace that does not use Nx Cloud, opt-in or not', () => {
    expect(isUltracacheConfigurationFetchEnabled({} as any, {}, optedIn)).toBe(
      false
    );
  });

  it("counts a Cloud token in the run's env as using Nx Cloud", () => {
    expect(
      isUltracacheConfigurationFetchEnabled(
        {} as any,
        {},
        { ...optedIn, hasNxCloudToken: true }
      )
    ).toBe(true);
  });

  it('is off when Nx Cloud is disabled, opt-in or not', () => {
    expect(
      isUltracacheConfigurationFetchEnabled(
        connected,
        {},
        { ...optedIn, NX_NO_CLOUD: 'true' }
      )
    ).toBe(false);
    expect(
      isUltracacheConfigurationFetchEnabled(
        { ...connected, neverConnectToCloud: true },
        {},
        optedIn
      )
    ).toBe(false);
    expect(
      isUltracacheConfigurationFetchEnabled(
        connected,
        { cloud: false },
        optedIn
      )
    ).toBe(false);
  });

  it('reads the run env by default', () => {
    delete process.env.NX_CLOUD_USE_ULTRACACHE;
    expect(isUltracacheConfigurationFetchEnabled(connected)).toBe(false);
    process.env.NX_CLOUD_USE_ULTRACACHE = 'true';
    expect(isUltracacheConfigurationFetchEnabled(connected)).toBe(true);
    delete process.env.NX_CLOUD_USE_ULTRACACHE;
  });
});

describe('ultracacheEnv', () => {
  it('carries whether a Cloud token is set, never the token', () => {
    const env = ultracacheEnv({ NX_CLOUD_ACCESS_TOKEN: 'secret' });
    expect(env.hasNxCloudToken).toBe(true);
    expect(JSON.stringify(env)).not.toContain('secret');
    expect(
      ultracacheEnv({ NX_CLOUD_AUTH_TOKEN: 'secret' }).hasNxCloudToken
    ).toBe(true);
    expect(ultracacheEnv({}).hasNxCloudToken).toBe(false);
  });
});
