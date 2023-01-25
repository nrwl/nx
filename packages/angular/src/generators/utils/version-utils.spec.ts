import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { updateJson } from '@nrwl/devkit';
import {
  getGeneratorDirectoryForInstalledAngularVersion,
  getInstalledAngularMajorVersion,
  getInstalledAngularVersion,
} from './version-utils';

describe('angularVersionUtils', () => {
  test.each(['14.0.0', '~14.1.0', '^14.2.0', '~14.3.0-beta.0'])(
    'should return correct directory name for v14',
    (ngVersion) => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: {
          '@angular/core': ngVersion,
        },
      }));

      // ACT
      const directoryName =
        getGeneratorDirectoryForInstalledAngularVersion(tree);

      // ASSERT
      expect(directoryName).toEqual('angular-v14');
    }
  );

  test.each(['14.0.0', '~14.1.0', '^14.2.0', '~14.3.0-beta.0'])(
    'should return correct major version',
    (ngVersion) => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: {
          '@angular/core': ngVersion,
        },
      }));

      // ACT
      const angularVersion = getInstalledAngularMajorVersion(tree);

      // ASSERT
      expect(angularVersion).toBe(14);
    }
  );

  test.each([
    ['14.0.0', '14.0.0'],
    ['~14.1.0', '14.1.0'],
    ['^14.2.0', '14.2.0'],
    ['~14.3.0-beta.0', '14.3.0'],
  ])('should return correct major version', (ngVersion, expectedVersion) => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: {
        '@angular/core': ngVersion,
      },
    }));

    // ACT
    const angularVersion = getInstalledAngularVersion(tree);

    // ASSERT
    expect(angularVersion).toEqual(expectedVersion);
  });

  test.each([
    '15.0.0',
    '~15.1.0',
    '^13.2.0',
    '~15.3.0-beta.0',
    'latest',
    'next',
  ])('should return null for anything other than v14', (ngVersion) => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: {
        '@angular/core': ngVersion,
      },
    }));

    // ACT
    const directoryName = getGeneratorDirectoryForInstalledAngularVersion(tree);

    // ASSERT
    expect(directoryName).toBe(null);
  });
});
