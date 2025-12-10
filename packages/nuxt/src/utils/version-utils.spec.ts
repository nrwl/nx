import { updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  getInstalledNuxtMajorVersion,
  getInstalledNuxtVersion,
} from './version-utils';

describe('nuxtVersionUtils', () => {
  describe('getInstalledNuxtMajorVersion', () => {
    test.each(['3.0.0', '~3.10.0', '^3.15.0', '~3.12.0-beta.0'])(
      'should return major version 3 for %s',
      (nuxtVersionString) => {
        // ARRANGE
        const tree = createTreeWithEmptyWorkspace();
        updateJson(tree, 'package.json', (json) => ({
          ...json,
          devDependencies: {
            nuxt: nuxtVersionString,
          },
        }));

        // ACT
        const nuxtMajorVersion = getInstalledNuxtMajorVersion(tree);

        // ASSERT
        expect(nuxtMajorVersion).toBe(3);
      }
    );

    test.each(['4.0.0', '~4.1.0', '^4.0.0', '~4.0.0-beta.0'])(
      'should return major version 4 for %s',
      (nuxtVersionString) => {
        // ARRANGE
        const tree = createTreeWithEmptyWorkspace();
        updateJson(tree, 'package.json', (json) => ({
          ...json,
          devDependencies: {
            nuxt: nuxtVersionString,
          },
        }));

        // ACT
        const nuxtMajorVersion = getInstalledNuxtMajorVersion(tree);

        // ASSERT
        expect(nuxtMajorVersion).toBe(4);
      }
    );

    it('should return undefined when nuxt is not installed', () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();

      // ACT
      const nuxtMajorVersion = getInstalledNuxtMajorVersion(tree);

      // ASSERT
      expect(nuxtMajorVersion).toBeUndefined();
    });
  });

  describe('getInstalledNuxtVersion', () => {
    test.each([
      ['3.10.0', '3.10.0'],
      ['~3.15.0', '3.15.0'],
      ['^4.0.0', '4.0.0'],
      ['~4.1.0-beta.0', '4.1.0'],
    ])(
      'should return cleaned version %s as %s',
      (nuxtVersionString, expectedVersion) => {
        // ARRANGE
        const tree = createTreeWithEmptyWorkspace();
        updateJson(tree, 'package.json', (json) => ({
          ...json,
          devDependencies: {
            nuxt: nuxtVersionString,
          },
        }));

        // ACT
        const nuxtVersion = getInstalledNuxtVersion(tree);

        // ASSERT
        expect(nuxtVersion).toEqual(expectedVersion);
      }
    );

    it('should return undefined for latest version', () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        devDependencies: {
          nuxt: 'latest',
        },
      }));

      // ACT
      const nuxtVersion = getInstalledNuxtVersion(tree);

      // ASSERT
      expect(nuxtVersion).toBeUndefined();
    });

    it('should return undefined for beta version', () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        devDependencies: {
          nuxt: 'beta',
        },
      }));

      // ACT
      const nuxtVersion = getInstalledNuxtVersion(tree);

      // ASSERT
      expect(nuxtVersion).toBeUndefined();
    });

    it('should return undefined when nuxt is not installed', () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();

      // ACT
      const nuxtVersion = getInstalledNuxtVersion(tree);

      // ASSERT
      expect(nuxtVersion).toBeUndefined();
    });
  });
});
