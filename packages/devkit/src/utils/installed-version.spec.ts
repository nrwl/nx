import { updateJson } from 'nx/src/devkit-exports';
import { createTreeWithEmptyWorkspace } from '../../testing';
import {
  getDeclaredPackageVersion,
  getInstalledPackageVersion,
} from './installed-version';

describe('getDeclaredPackageVersion', () => {
  it('returns the cleaned version for a declared range', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': '^1.5.2' },
    }));

    expect(getDeclaredPackageVersion(tree, 'some-pkg')).toBe('1.5.2');
  });

  it('returns null when the package is not declared and no fallback is provided', () => {
    const tree = createTreeWithEmptyWorkspace();
    expect(getDeclaredPackageVersion(tree, 'some-pkg')).toBeNull();
  });

  it('falls back to the cleaned `latestKnownVersion` when the package is not declared', () => {
    const tree = createTreeWithEmptyWorkspace();
    expect(getDeclaredPackageVersion(tree, 'some-pkg', '^2.3.4')).toBe('2.3.4');
  });

  it('resolves `latest` to the cleaned `latestKnownVersion`', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': 'latest' },
    }));

    expect(getDeclaredPackageVersion(tree, 'some-pkg', '^2.3.4')).toBe('2.3.4');
  });

  it('resolves `next` to the cleaned `latestKnownVersion`', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': 'next' },
    }));

    expect(getDeclaredPackageVersion(tree, 'some-pkg', '^2.3.4')).toBe('2.3.4');
  });

  it('returns null for `latest` when no `latestKnownVersion` is provided', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': 'latest' },
    }));

    expect(getDeclaredPackageVersion(tree, 'some-pkg')).toBeNull();
  });

  it('returns null when the declared range cannot be normalized', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': 'workspace:*' },
    }));

    expect(getDeclaredPackageVersion(tree, 'some-pkg')).toBeNull();
  });
});

describe('getInstalledPackageVersion', () => {
  it('returns null for an unresolvable package', () => {
    expect(
      getInstalledPackageVersion('some-pkg-that-cannot-possibly-exist-xyz')
    ).toBeNull();
  });

  it('returns the concrete installed version for a resolvable package', () => {
    expect(getInstalledPackageVersion('semver')).toMatch(/^\d+\.\d+\.\d+/);
  });
});
