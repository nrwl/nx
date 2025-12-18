import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  getInstalledExpoVersion,
  getInstalledExpoMajorVersion,
  isExpoV53,
  isExpoV54,
  getExpoDependenciesVersionsToInstall,
} from './version-utils';

// Mock the project graph
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockResolvedValue({
    externalNodes: {},
  }),
}));

describe('version-utils', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('getInstalledExpoVersion', () => {
    it('should return null when expo is not installed', () => {
      const version = getInstalledExpoVersion(tree);
      expect(version).toBeNull();
    });

    it('should return version when expo is installed in dependencies', () => {
      tree.write(
        'package.json',
        JSON.stringify({
          dependencies: { expo: '~53.0.10' },
        })
      );
      const version = getInstalledExpoVersion(tree);
      expect(version).toBe('53.0.10');
    });

    it('should return version when expo is installed in devDependencies', () => {
      tree.write(
        'package.json',
        JSON.stringify({
          devDependencies: { expo: '~54.0.0' },
        })
      );
      const version = getInstalledExpoVersion(tree);
      expect(version).toBe('54.0.0');
    });

    it('should handle caret versions', () => {
      tree.write(
        'package.json',
        JSON.stringify({
          dependencies: { expo: '^54.0.0' },
        })
      );
      const version = getInstalledExpoVersion(tree);
      expect(version).toBe('54.0.0');
    });

    it('should return null for latest tag', () => {
      tree.write(
        'package.json',
        JSON.stringify({
          dependencies: { expo: 'latest' },
        })
      );
      const version = getInstalledExpoVersion(tree);
      expect(version).toBeNull();
    });

    it('should return null for beta tag', () => {
      tree.write(
        'package.json',
        JSON.stringify({
          dependencies: { expo: 'beta' },
        })
      );
      const version = getInstalledExpoVersion(tree);
      expect(version).toBeNull();
    });
  });

  describe('getInstalledExpoMajorVersion', () => {
    it('should return undefined when expo is not installed', () => {
      const majorVersion = getInstalledExpoMajorVersion(tree);
      expect(majorVersion).toBeUndefined();
    });

    it('should return 53 for v53', () => {
      tree.write(
        'package.json',
        JSON.stringify({
          dependencies: { expo: '~53.0.10' },
        })
      );
      const majorVersion = getInstalledExpoMajorVersion(tree);
      expect(majorVersion).toBe(53);
    });

    it('should return 54 for v54', () => {
      tree.write(
        'package.json',
        JSON.stringify({
          dependencies: { expo: '~54.0.0' },
        })
      );
      const majorVersion = getInstalledExpoMajorVersion(tree);
      expect(majorVersion).toBe(54);
    });

    it('should return undefined for unsupported versions', () => {
      tree.write(
        'package.json',
        JSON.stringify({
          dependencies: { expo: '~52.0.0' },
        })
      );
      const majorVersion = getInstalledExpoMajorVersion(tree);
      expect(majorVersion).toBeUndefined();
    });
  });

  describe('isExpoV53', () => {
    it('should return false when expo is not installed', async () => {
      const result = await isExpoV53(tree);
      expect(result).toBe(false);
    });

    it('should return true for v53', async () => {
      tree.write(
        'package.json',
        JSON.stringify({
          dependencies: { expo: '~53.0.10' },
        })
      );
      const result = await isExpoV53(tree);
      expect(result).toBe(true);
    });

    it('should return false for v54', async () => {
      tree.write(
        'package.json',
        JSON.stringify({
          dependencies: { expo: '~54.0.0' },
        })
      );
      const result = await isExpoV53(tree);
      expect(result).toBe(false);
    });
  });

  describe('isExpoV54', () => {
    it('should return true when expo is not installed (default to latest)', async () => {
      const result = await isExpoV54(tree);
      expect(result).toBe(true);
    });

    it('should return false for v53', async () => {
      tree.write(
        'package.json',
        JSON.stringify({
          dependencies: { expo: '~53.0.10' },
        })
      );
      const result = await isExpoV54(tree);
      expect(result).toBe(false);
    });

    it('should return true for v54', async () => {
      tree.write(
        'package.json',
        JSON.stringify({
          dependencies: { expo: '~54.0.0' },
        })
      );
      const result = await isExpoV54(tree);
      expect(result).toBe(true);
    });
  });

  describe('getExpoDependenciesVersionsToInstall', () => {
    it('should return v54 versions for fresh workspace', async () => {
      const versions = await getExpoDependenciesVersionsToInstall(tree);
      expect(versions.expo).toContain('54');
      expect(versions.reactNative).toContain('0.81');
      expect(versions.react).toContain('19.1');
    });

    it('should return v53 versions when v53 is installed', async () => {
      tree.write(
        'package.json',
        JSON.stringify({
          dependencies: { expo: '~53.0.10' },
        })
      );
      const versions = await getExpoDependenciesVersionsToInstall(tree);
      expect(versions.expo).toContain('53');
      expect(versions.reactNative).toContain('0.79');
      expect(versions.react).toContain('19.0');
    });

    it('should return v54 versions when v54 is installed', async () => {
      tree.write(
        'package.json',
        JSON.stringify({
          dependencies: { expo: '~54.0.0' },
        })
      );
      const versions = await getExpoDependenciesVersionsToInstall(tree);
      expect(versions.expo).toContain('54');
      expect(versions.reactNative).toContain('0.81');
    });

    it('should include shared versions regardless of expo version', async () => {
      const versions = await getExpoDependenciesVersionsToInstall(tree);
      expect(versions.reactNativeSvgTransformer).toBeDefined();
      expect(versions.reactNativeSvg).toBeDefined();
      expect(versions.testingLibraryReactNative).toBeDefined();
      expect(versions.babelRuntime).toBeDefined();
    });
  });
});
