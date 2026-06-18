import * as angularVersionUtils from '../../utilities/angular-version-utils';
import type { ApplicationExecutorOptions } from '../schema';
import { normalizeOptions } from './normalize-options';

// The builder's `ssr` type is version-specific (v22 only knows `platform`,
// earlier majors only `experimentalPlatform`), so the helper widens to read and
// return both, matching what `normalizeOptions` accepts and bridges.
type SsrPlatformInput =
  | boolean
  | {
      entry?: string;
      platform?: 'node' | 'neutral';
      experimentalPlatform?: 'node' | 'neutral';
    };

function normalizeSsr(ssr: SsrPlatformInput): SsrPlatformInput {
  return normalizeOptions({ ssr } as ApplicationExecutorOptions)
    .ssr as SsrPlatformInput;
}

describe('normalizeOptions', () => {
  let getInstalledAngularVersionInfoSpy: jest.SpyInstance;

  beforeEach(() => {
    getInstalledAngularVersionInfoSpy = jest.spyOn(
      angularVersionUtils,
      'getInstalledAngularVersionInfo'
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should preserve other options untouched', () => {
    getInstalledAngularVersionInfoSpy.mockReturnValue({
      major: 22,
      version: '22.0.0',
    });

    const result = normalizeOptions({
      tsConfig: 'tsconfig.app.json',
      ssr: { entry: 'server.ts', experimentalPlatform: 'neutral' },
    } as ApplicationExecutorOptions);

    expect(result.tsConfig).toBe('tsconfig.app.json');
    expect(result.ssr).toEqual({ entry: 'server.ts', platform: 'neutral' });
  });

  it.each([undefined, false, true])(
    'should leave non-object ssr (%s) unchanged',
    (ssr) => {
      getInstalledAngularVersionInfoSpy.mockReturnValue({
        major: 22,
        version: '22.0.0',
      });

      expect(normalizeSsr(ssr as ApplicationExecutorOptions['ssr'])).toBe(ssr);
    }
  );

  it('should leave the ssr object unchanged when no platform is set', () => {
    getInstalledAngularVersionInfoSpy.mockReturnValue({
      major: 22,
      version: '22.0.0',
    });
    const ssr = { entry: 'server.ts' };

    expect(normalizeSsr(ssr)).toBe(ssr);
  });

  describe('when Angular version is >= 22', () => {
    beforeEach(() => {
      getInstalledAngularVersionInfoSpy.mockReturnValue({
        major: 22,
        version: '22.0.0',
      });
    });

    it('should map experimentalPlatform to platform', () => {
      expect(
        normalizeSsr({ entry: 'server.ts', experimentalPlatform: 'neutral' })
      ).toEqual({ entry: 'server.ts', platform: 'neutral' });
    });

    it('should keep platform as-is', () => {
      expect(normalizeSsr({ entry: 'server.ts', platform: 'neutral' })).toEqual(
        { entry: 'server.ts', platform: 'neutral' }
      );
    });

    it('should prefer platform over experimentalPlatform when both are set', () => {
      expect(
        normalizeSsr({
          entry: 'server.ts',
          platform: 'neutral',
          experimentalPlatform: 'node',
        })
      ).toEqual({ entry: 'server.ts', platform: 'neutral' });
    });
  });

  describe('when Angular version is < 22', () => {
    beforeEach(() => {
      getInstalledAngularVersionInfoSpy.mockReturnValue({
        major: 21,
        version: '21.2.0',
      });
    });

    it('should map platform to experimentalPlatform', () => {
      expect(normalizeSsr({ entry: 'server.ts', platform: 'neutral' })).toEqual(
        { entry: 'server.ts', experimentalPlatform: 'neutral' }
      );
    });

    it('should keep experimentalPlatform as-is', () => {
      expect(
        normalizeSsr({ entry: 'server.ts', experimentalPlatform: 'neutral' })
      ).toEqual({ entry: 'server.ts', experimentalPlatform: 'neutral' });
    });

    it('should prefer platform over experimentalPlatform when both are set', () => {
      expect(
        normalizeSsr({
          entry: 'server.ts',
          platform: 'neutral',
          experimentalPlatform: 'node',
        })
      ).toEqual({ entry: 'server.ts', experimentalPlatform: 'neutral' });
    });
  });
});
