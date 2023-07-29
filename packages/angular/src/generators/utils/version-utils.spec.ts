import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { updateJson } from '@nx/devkit';
import {
  getInstalledAngularMajorVersion,
  getInstalledAngularVersion,
} from './version-utils';

describe('angularVersionUtils', () => {
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
});
