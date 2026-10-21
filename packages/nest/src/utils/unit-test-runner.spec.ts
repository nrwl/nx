import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  type Tree,
  updateJson,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  assertJestSupported,
  configureJestForEsmOnlyNestJs,
  getDefaultUnitTestRunner,
} from './unit-test-runner';

const realNodeVersion = process.versions.node;
const setNodeVersion = (version: string) =>
  Object.defineProperty(process.versions, 'node', {
    value: version,
    configurable: true,
  });

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
    afterEach(() => setNodeVersion(realNodeVersion));

    it('should throw below Node 24.9 when Nest is not installed', () => {
      setNodeVersion('22.12.0');

      expect(() => assertJestSupported(tree)).toThrow(
        /requires Node\.js 24\.9\.0 or later, but this runs on Node\.js 22\.12\.0/
      );
    });

    it('should throw below Node 24.9 when Nest is 12', () => {
      setNodeVersion('24.8.0');
      installNest('^12.0.0');

      expect(() => assertJestSupported(tree)).toThrow(
        /--unitTestRunner=vitest/
      );
    });

    it('should not throw on Node 24.9+ when Nest is 12', () => {
      setNodeVersion('24.9.0');
      installNest('^12.0.0');

      expect(() => assertJestSupported(tree)).not.toThrow();
    });

    it.each(['^11.0.0', '~10.4.0'])(
      'should not throw below Node 24.9 when Nest is %s',
      (version) => {
        setNodeVersion('22.12.0');
        installNest(version);

        expect(() => assertJestSupported(tree)).not.toThrow();
      }
    );
  });

  describe('configureJestForEsmOnlyNestJs', () => {
    beforeEach(() => {
      addProjectConfiguration(tree, 'api', {
        root: 'apps/api',
        targets: { test: { options: { passWithNoTests: true } } },
      });
    });

    it('should run the jest target with --experimental-vm-modules on top of the inferred env', () => {
      configureJestForEsmOnlyNestJs(tree, 'api');

      expect(
        readProjectConfiguration(tree, 'api').targets.test.options
      ).toEqual({
        passWithNoTests: true,
        env: {
          '...': true,
          NODE_OPTIONS: '--experimental-vm-modules',
        },
      });
    });

    it('should use the jest plugin target name', () => {
      updateNxJson(tree, {
        plugins: [
          { plugin: '@nx/jest/plugin', options: { targetName: 'jest-test' } },
        ],
      });

      configureJestForEsmOnlyNestJs(tree, 'api');

      expect(
        readProjectConfiguration(tree, 'api').targets['jest-test'].options.env
          .NODE_OPTIONS
      ).toBe('--experimental-vm-modules');
    });

    it('should upgrade jest and a declared jest-environment-node to 30.5', () => {
      updateJson(tree, 'package.json', (json) => {
        json.devDependencies = {
          ...json.devDependencies,
          jest: '~30.3.0',
          'jest-environment-node': '~30.3.0',
        };
        return json;
      });

      configureJestForEsmOnlyNestJs(tree, 'api');

      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies.jest).toBe('^30.5.0');
      expect(devDependencies['jest-environment-node']).toBe('^30.5.0');
    });

    it('should not add jest-environment-node', () => {
      configureJestForEsmOnlyNestJs(tree, 'api');

      expect(
        readJson(tree, 'package.json').devDependencies['jest-environment-node']
      ).toBeUndefined();
    });
  });
});
