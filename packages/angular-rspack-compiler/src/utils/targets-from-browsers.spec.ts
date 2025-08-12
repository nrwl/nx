import { describe, it, expect } from 'vitest';
import { transformSupportedBrowsersToTargets } from './targets-from-browsers';

describe('transformSupportedBrowsersToTargets', () => {
  it('should transform supported browsers correctly with names and versions', () => {
    const supportedBrowsers = [
      'chrome 100',
      'firefox 99',
      'safari 15',
      'edge 101',
      'ie 11',
    ];

    expect(transformSupportedBrowsersToTargets(supportedBrowsers)).toEqual([
      'chrome100.0',
      'firefox99.0',
      'safari15.0',
      'edge101.0',
      'ie11.0',
    ]);
  });

  it('should map `ios_saf` to `ios`', () => {
    const supportedBrowsers = ['ios_saf 15'];
    expect(transformSupportedBrowsersToTargets(supportedBrowsers)).toEqual([
      'ios15.0',
    ]);
  });

  it('should extract the lowest version from version ranges', () => {
    const supportedBrowsers = ['ie 13.4-13.5'];
    expect(transformSupportedBrowsersToTargets(supportedBrowsers)).toEqual([
      'ie13.4',
    ]);
  });

  it('should convert Safari TP version to 999', () => {
    const supportedBrowsers = ['safari tp'];
    expect(transformSupportedBrowsersToTargets(supportedBrowsers)).toEqual([
      'safari999',
    ]);
  });

  it('should append `.0` to browsers with only a major version', () => {
    const supportedBrowsers = ['chrome 100', 'firefox 99'];
    expect(transformSupportedBrowsersToTargets(supportedBrowsers)).toEqual([
      'chrome100.0',
      'firefox99.0',
    ]);
  });

  it('should retain explicit minor versions (e.g., "5.5" should remain "5.5")', () => {
    const supportedBrowsers = ['ie 5.5'];
    expect(transformSupportedBrowsersToTargets(supportedBrowsers)).toEqual([
      'ie5.5',
    ]);
  });

  it('should throw an error when a browser does not have a version', () => {
    const supportedBrowsers = ['chrome'];
    expect(() =>
      transformSupportedBrowsersToTargets(supportedBrowsers)
    ).toThrow('Invalid browser version in: chrome');
  });

  it('should exclude unsupported browsers', () => {
    const supportedBrowsers = ['netscape 4.0', 'opera_mini 8'];
    expect(transformSupportedBrowsersToTargets(supportedBrowsers)).toEqual([]);
  });

  it('should normalize browser names to lowercase before processing', () => {
    const supportedBrowsers = ['Chrome 100', 'FireFox 99'];
    expect(transformSupportedBrowsersToTargets(supportedBrowsers)).toEqual([
      'chrome100.0',
      'firefox99.0',
    ]);
  });
});
