import { getPackageNameFromThirdPartyPreset } from './get-third-party-preset';

describe('getPackageNameFromThirdPartyPreset', () => {
  it('should throw an error if preset is invalid', () => {
    expect(() => getPackageNameFromThirdPartyPreset('_random')).toThrow();
  });

  it('should return undefined if preset is known nx preset', () => {
    expect(getPackageNameFromThirdPartyPreset('react')).toBeUndefined();
    expect(getPackageNameFromThirdPartyPreset('angular')).toBeUndefined();
  });

  it('should return package name if it is valid package', () => {
    expect(getPackageNameFromThirdPartyPreset('@nx-go/nx-go')).toEqual(
      '@nx-go/nx-go'
    );
    expect(getPackageNameFromThirdPartyPreset('@nx-go/nx-go@19.0.0')).toEqual(
      '@nx-go/nx-go'
    );
  });
});
