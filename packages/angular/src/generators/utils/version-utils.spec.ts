import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { updateJson } from '@nx/devkit';
import {
  getInstalledAngularMajorVersion,
  getInstalledAngularVersion,
} from './version-utils';

describe('angularVersionUtils', () => {
  test.each(['15.0.0', '~15.1.0', '^15.2.0', '~15.3.0-beta.0'])(
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
      expect(angularVersion).toBe(15);
    }
  );

  test.each([
    ['15.0.0', '15.0.0'],
    ['~15.1.0', '15.1.0'],
    ['^15.2.0', '15.2.0'],
    ['~15.3.0-beta.0', '15.3.0'],
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
});
