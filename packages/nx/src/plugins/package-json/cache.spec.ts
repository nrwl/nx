import '../../internal-testing-utils/mock-fs';
import { vol } from 'memfs';
import { PackageJsonConfigurationCache } from './cache';

describe('package-json configuration cache', () => {
  const path = '/root/.nx/package-json.hash';
  afterEach(() => vol.reset());

  it('prunes projects that are no longer used, including an empty workspace', () => {
    const first = new PackageJsonConfigurationCache(path);
    first.set('a', { project: { root: 'a' } });
    first.set('b', { project: { root: 'b' } });
    first.writeToDiskIfChanged();

    const second = new PackageJsonConfigurationCache(path);
    expect(second.get('b')).toEqual({ project: { root: 'b' } });
    second.writeToDiskIfChanged();
    expect(
      Object.keys(JSON.parse(vol.readFileSync(path, 'utf8').toString()).entries)
    ).toEqual(['b']);

    const third = new PackageJsonConfigurationCache(path);
    third.writeToDiskIfChanged();
    expect(
      JSON.parse(vol.readFileSync(path, 'utf8').toString()).entries
    ).toEqual({});
  });

  it('replaces resolution-dependent entries without accumulating old values', () => {
    const first = new PackageJsonConfigurationCache(path);
    first.set('a', { project: { root: 'a' }, hasNxJsPlugin: false });
    first.writeToDiskIfChanged();
    const second = new PackageJsonConfigurationCache(path);
    second.get('a');
    second.set('a', { project: { root: 'a' }, hasNxJsPlugin: true });
    second.writeToDiskIfChanged();
    const entries = JSON.parse(
      vol.readFileSync(path, 'utf8').toString()
    ).entries;
    expect(Object.keys(entries)).toEqual(['a']);
    expect(entries.a.hasNxJsPlugin).toBe(true);
  });
});
