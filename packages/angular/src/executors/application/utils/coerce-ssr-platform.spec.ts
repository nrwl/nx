import * as angularVersionUtils from '../../utilities/angular-version-utils';
import { coerceSsrPlatformOption } from './coerce-ssr-platform';

describe('coerceSsrPlatformOption', () => {
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

  it.each([undefined, false, true])(
    'should return non-object ssr (%s) unchanged',
    (ssr) => {
      getInstalledAngularVersionInfoSpy.mockReturnValue({
        major: 22,
        version: '22.0.0',
      });

      expect(coerceSsrPlatformOption(ssr)).toBe(ssr);
    }
  );

  it('should return the ssr object unchanged when no platform is set', () => {
    getInstalledAngularVersionInfoSpy.mockReturnValue({
      major: 22,
      version: '22.0.0',
    });
    const ssr = { entry: 'server.ts' };

    expect(coerceSsrPlatformOption(ssr)).toBe(ssr);
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
        coerceSsrPlatformOption({
          entry: 'server.ts',
          experimentalPlatform: 'neutral',
        })
      ).toEqual({ entry: 'server.ts', platform: 'neutral' });
    });

    it('should keep platform as-is', () => {
      expect(
        coerceSsrPlatformOption({ entry: 'server.ts', platform: 'neutral' })
      ).toEqual({ entry: 'server.ts', platform: 'neutral' });
    });

    it('should prefer platform over experimentalPlatform when both are set', () => {
      expect(
        coerceSsrPlatformOption({
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
      expect(
        coerceSsrPlatformOption({ entry: 'server.ts', platform: 'neutral' })
      ).toEqual({ entry: 'server.ts', experimentalPlatform: 'neutral' });
    });

    it('should keep experimentalPlatform as-is', () => {
      expect(
        coerceSsrPlatformOption({
          entry: 'server.ts',
          experimentalPlatform: 'neutral',
        })
      ).toEqual({ entry: 'server.ts', experimentalPlatform: 'neutral' });
    });

    it('should prefer platform over experimentalPlatform when both are set', () => {
      expect(
        coerceSsrPlatformOption({
          entry: 'server.ts',
          platform: 'neutral',
          experimentalPlatform: 'node',
        })
      ).toEqual({ entry: 'server.ts', experimentalPlatform: 'neutral' });
    });
  });

  it('should default to the platform key when the Angular version is unknown', () => {
    getInstalledAngularVersionInfoSpy.mockReturnValue(null);

    expect(
      coerceSsrPlatformOption({
        entry: 'server.ts',
        experimentalPlatform: 'neutral',
      })
    ).toEqual({ entry: 'server.ts', platform: 'neutral' });
  });
});
