import { addDependenciesToPackageJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  assertJestSupported,
  getDefaultUnitTestRunner,
} from './unit-test-runner';

describe('unit test runner', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  const installNest = (version: string) =>
    addDependenciesToPackageJson(tree, { '@nestjs/core': version }, {});

  describe('getDefaultUnitTestRunner', () => {
    it('should be vitest when Nest is not installed', () => {
      expect(getDefaultUnitTestRunner(tree)).toBe('vitest');
    });

    it.each(['^12.0.0', '12.2.0', '^13.0.0'])(
      'should be vitest when Nest is %s',
      (version) => {
        installNest(version);

        expect(getDefaultUnitTestRunner(tree)).toBe('vitest');
      }
    );

    it.each(['^11.0.0', '~10.4.0'])(
      'should be jest when Nest is %s',
      (version) => {
        installNest(version);

        expect(getDefaultUnitTestRunner(tree)).toBe('jest');
      }
    );
  });

  describe('assertJestSupported', () => {
    it('should throw when Nest is not installed', () => {
      expect(() => assertJestSupported(tree)).toThrow(
        /cannot load @nestjs\/testing 12/
      );
    });

    it('should throw when Nest is 12', () => {
      installNest('^12.0.0');

      expect(() => assertJestSupported(tree)).toThrow(
        /--unitTestRunner=vitest/
      );
    });

    it.each(['^11.0.0', '~10.4.0'])(
      'should not throw when Nest is %s',
      (version) => {
        installNest(version);

        expect(() => assertJestSupported(tree)).not.toThrow();
      }
    );
  });
});
