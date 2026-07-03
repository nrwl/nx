import { parseFlavor } from './flavor';
import { buildTagStrings } from './tags-output';
import { ParsedImage, ResolvedVersion } from './types';

const defaultFlavor = parseFlavor([]);

describe('buildTagStrings', () => {
  it('returns no tags when there is no main version', () => {
    const version: ResolvedVersion = {
      main: undefined,
      partial: [],
      latest: false,
    };
    expect(buildTagStrings([], version, defaultFlavor)).toEqual([]);
  });

  it('emits bare tags when no images are configured', () => {
    const version: ResolvedVersion = {
      main: '1.2.3',
      partial: ['1.2'],
      latest: false,
    };
    expect(buildTagStrings([], version, defaultFlavor)).toEqual([
      '1.2.3',
      '1.2',
    ]);
  });

  it('fans out across multiple enabled images', () => {
    const images: ParsedImage[] = [
      { name: 'ghcr.io/org/app', enable: true },
      { name: 'docker.io/org/app', enable: true },
    ];
    const version: ResolvedVersion = {
      main: '1.2.3',
      partial: [],
      latest: false,
    };
    expect(buildTagStrings(images, version, defaultFlavor)).toEqual([
      'ghcr.io/org/app:1.2.3',
      'docker.io/org/app:1.2.3',
    ]);
  });

  it('skips disabled images', () => {
    const images: ParsedImage[] = [
      { name: 'ghcr.io/org/app', enable: false },
      { name: 'docker.io/org/app', enable: true },
    ];
    const version: ResolvedVersion = {
      main: '1.2.3',
      partial: [],
      latest: false,
    };
    expect(buildTagStrings(images, version, defaultFlavor)).toEqual([
      'docker.io/org/app:1.2.3',
    ]);
  });

  it('appends a latest tag when the version is flagged latest', () => {
    const images: ParsedImage[] = [{ name: 'app', enable: true }];
    const version: ResolvedVersion = {
      main: '1.2.3',
      partial: [],
      latest: true,
    };
    expect(buildTagStrings(images, version, defaultFlavor)).toEqual([
      'app:1.2.3',
      'app:latest',
    ]);
  });

  it('applies flavor prefix/suffix to the latest tag only when onlatest is set', () => {
    const flavor = parseFlavor([
      'prefix=v-,onlatest=true',
      'suffix=-alpine,onlatest=true',
    ]);
    const images: ParsedImage[] = [{ name: 'app', enable: true }];
    const version: ResolvedVersion = {
      main: '1.2.3',
      partial: [],
      latest: true,
    };
    expect(buildTagStrings(images, version, flavor)).toEqual([
      'app:1.2.3',
      'app:v-latest-alpine',
    ]);
  });

  it('lowercases image names', () => {
    const images: ParsedImage[] = [{ name: 'GHCR.io/Org/App', enable: true }];
    const version: ResolvedVersion = {
      main: '1.2.3',
      partial: [],
      latest: false,
    };
    expect(buildTagStrings(images, version, defaultFlavor)).toEqual([
      'ghcr.io/org/app:1.2.3',
    ]);
  });
});
