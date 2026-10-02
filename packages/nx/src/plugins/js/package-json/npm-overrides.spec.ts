import type { PackageJson } from '../../../utils/package-json';
import {
  applyNpmOverridesToDependencies,
  dropNpmOverridesOfDirectDependencies,
  resolveNpmOverrideReferences,
} from './npm-overrides';

function manifest(sections: Partial<PackageJson>): PackageJson {
  return { name: 'app', version: '0.0.1', ...sections };
}

describe('npm overrides', () => {
  describe('applyNpmOverridesToDependencies', () => {
    it("should give a direct dependency the spec its override sets, the string or an object's `.`", () => {
      const packageJson = manifest({
        dependencies: { uuid: '11.1.0', foo: '^1.0.0', bar: '^1.0.0' },
      });

      applyNpmOverridesToDependencies(packageJson, {
        uuid: '^11.1.1',
        foo: { '.': '2.0.0', baz: '1.0.0' },
        bar: { baz: '1.0.0' },
      });

      expect(packageJson.dependencies).toEqual({
        uuid: '^11.1.1',
        foo: '2.0.0',
        bar: '^1.0.0',
      });
    });

    it('should apply a name@range override only to a dependency its range intersects', () => {
      const packageJson = manifest({
        dependencies: {
          'js-yaml': '^4.3.1',
          debug: '^4.3.4',
          '@scope/foo': '^1.0.0',
          'ms-alias': 'npm:ms@^2.1.0',
        },
      });

      applyNpmOverridesToDependencies(packageJson, {
        'js-yaml@^4.0.0': '4.3.2',
        'debug@^2': '2.6.9',
        '@scope/foo@^1': '1.2.0',
        'ms-alias@^2': 'npm:ms@2.1.3',
      });

      expect(packageJson.dependencies).toEqual({
        'js-yaml': '4.3.2',
        debug: '^4.3.4',
        '@scope/foo': '1.2.0',
        'ms-alias': 'npm:ms@2.1.3',
      });
    });

    it('should fail when the rewritten spec matches another override that changes it', () => {
      // npm resolves debug@^3.2.7 to 4.3.4, but as a direct dependency 4.3.4
      // matches debug@^4, which npm rejects (EOVERRIDE)
      expect(() =>
        applyNpmOverridesToDependencies(
          manifest({ dependencies: { debug: '^3.2.7' } }),
          { 'debug@^3': '4.3.4', 'debug@^4': '4.3.5' }
        )
      ).toThrow(
        'The root override "debug@^3" resolves the dependencies entry debug@^3.2.7 to 4.3.4. In the pruned output debug@4.3.4 is a direct dependency that the override "debug@^4" changes to 4.3.5'
      );
    });
  });

  describe('dropNpmOverridesOfDirectDependencies', () => {
    it('should drop a rule that sets a direct dependency version and keep the rest', () => {
      expect(
        dropNpmOverridesOfDirectDependencies(
          { typescript: '5.0.0', foo: '1.0.0' },
          manifest({ dependencies: { typescript: '^4.8.4' } })
        )
      ).toEqual({ foo: '1.0.0' });
    });

    it("should keep the rules an override sets for a direct dependency's own dependencies", () => {
      expect(
        dropNpmOverridesOfDirectDependencies(
          {
            // only constrains the package's dependencies: npm accepts it
            'libphonenumber-geo-carrier': {
              'libphonenumber-js': '$libphonenumber-js',
            },
            // `.` sets the version npm would reject; its children stay
            debug: { '.': '4.3.5', ms: '2.1.3' },
          },
          manifest({
            dependencies: {
              'libphonenumber-geo-carrier': '2.0.0',
              'libphonenumber-js': '1.13.10',
              debug: '4.3.4',
            },
          })
        )
      ).toEqual({
        'libphonenumber-geo-carrier': {
          'libphonenumber-js': '$libphonenumber-js',
        },
        debug: { ms: '2.1.3' },
      });
    });

    it('should keep a rule that leaves the direct dependency spec as it is', () => {
      const overrides = {
        'debug@^2': '2.6.8',
        ms: '2.1.3',
        uuid: '$uuid',
      };

      expect(
        dropNpmOverridesOfDirectDependencies(
          overrides,
          manifest({
            dependencies: { debug: '4.3.4', ms: '2.1.3', uuid: '11.1.1' },
          })
        )
      ).toEqual(overrides);
    });

    it('should drop each rule npm would apply to the direct dependency in turn', () => {
      expect(
        dropNpmOverridesOfDirectDependencies(
          {
            // an object without `.` on a ranged key sets the key's range
            'debug@^4': { ms: '2.1.3' },
            'debug@>=4.3': '4.3.5',
            'debug@^3': '4.3.4',
          },
          manifest({ dependencies: { debug: '4.3.4' } })
        )
      ).toEqual({ 'debug@^3': '4.3.4' });
    });
  });

  describe('resolveNpmOverrideReferences', () => {
    it('should resolve $ references in the order npm looks them up', () => {
      expect(
        resolveNpmOverrideReferences(
          {
            ms: '$ms',
            debug: '$debug',
            uuid: '$uuid',
            foo: { bar: '$ms' },
            missing: '$missing',
          },
          manifest({
            dependencies: { ms: '2.0.0', debug: '4.3.4', uuid: '11.0.0' },
            optionalDependencies: { ms: '2.1.3' },
            devDependencies: { debug: '4.3.5' },
            peerDependencies: { uuid: '10.0.0' },
          })
        )
      ).toEqual({
        // devDependencies, then optionalDependencies, dependencies, peers
        ms: '2.1.3',
        debug: '4.3.5',
        uuid: '11.0.0',
        foo: { bar: '2.1.3' },
        missing: '$missing',
      });
    });
  });
});
