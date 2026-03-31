import { getMergeValueResult } from './utils';

describe('getMergeValueResult - spread token behavior', () => {
  const NX_SPREAD_TOKEN = '...';

  describe('basic spread token merging', () => {
    it('should merge array with spread token at beginning', () => {
      const base = ['x', 'y'];
      const newValue = [NX_SPREAD_TOKEN, 'a', 'b'];
      const result = getMergeValueResult(base, newValue);
      expect(result).toEqual(['x', 'y', 'a', 'b']);
    });

    it('should merge array with spread token at end', () => {
      const base = ['x', 'y'];
      const newValue = ['a', 'b', NX_SPREAD_TOKEN];
      const result = getMergeValueResult(base, newValue);
      expect(result).toEqual(['a', 'b', 'x', 'y']);
    });

    it('should merge array with spread token in middle', () => {
      const base = ['x', 'y'];
      const newValue = ['a', NX_SPREAD_TOKEN, 'b'];
      const result = getMergeValueResult(base, newValue);
      expect(result).toEqual(['a', 'x', 'y', 'b']);
    });

    it('should replace array when no spread token present', () => {
      const base = ['x', 'y'];
      const newValue = ['a', 'b'];
      const result = getMergeValueResult(base, newValue);
      expect(result).toEqual(['a', 'b']);
    });
  });

  describe('nested spread token merging - base contains unexpanded spread token', () => {
    it('should handle base array containing literal spread token when spreading', () => {
      // Simulates: target defaults has ['a', '...'], then merged with package.json ['...', 'b']
      const base = ['a', NX_SPREAD_TOKEN]; // Result from first merge
      const newValue = [NX_SPREAD_TOKEN, 'b'];
      const result = getMergeValueResult(base, newValue);

      // The literal '...' from base gets included in the spread
      expect(result).toEqual(['a', NX_SPREAD_TOKEN, 'b']);
    });

    it('should handle multiple levels of spread token nesting', () => {
      // Level 1: target defaults
      const targetDefaults = ['td1', NX_SPREAD_TOKEN];

      // Level 2: merge with package.json
      const packageJson = [NX_SPREAD_TOKEN, 'pkg1'];
      const afterPackageJson = getMergeValueResult(targetDefaults, packageJson);
      expect(afterPackageJson).toEqual(['td1', NX_SPREAD_TOKEN, 'pkg1']);

      // Level 3: merge with project.json
      const projectJson = [NX_SPREAD_TOKEN, 'proj1'];
      const final = getMergeValueResult(afterPackageJson, projectJson);

      // Now we have nested spread tokens
      expect(final).toEqual(['td1', NX_SPREAD_TOKEN, 'pkg1', 'proj1']);
    });

    it('should handle spread token at different positions in multi-layer merge', () => {
      // Layer 1: target defaults
      const layer1 = [NX_SPREAD_TOKEN, 'a'];

      // Layer 2: merge with base ['x']
      const base = ['x'];
      const afterLayer1 = getMergeValueResult(base, layer1);
      expect(afterLayer1).toEqual(['x', 'a']);

      // Layer 3: merge with another spread token array
      const layer3 = ['b', NX_SPREAD_TOKEN, 'c'];
      const final = getMergeValueResult(afterLayer1, layer3);
      expect(final).toEqual(['b', 'x', 'a', 'c']);
    });

    it('should handle case where all three layers have spread tokens', () => {
      // This is the specific scenario the user is concerned about:
      // target defaults, package.json, and project.json all have spread tokens

      // Base (from some earlier source)
      const originalBase = ['original'];

      // Layer 1: target defaults with spread
      const targetDefaults = [NX_SPREAD_TOKEN, 'td'];
      const afterTargetDefaults = getMergeValueResult(
        originalBase,
        targetDefaults
      );
      expect(afterTargetDefaults).toEqual(['original', 'td']);

      // Layer 2: package.json with spread
      const packageJson = ['pkg', NX_SPREAD_TOKEN];
      const afterPackageJson = getMergeValueResult(
        afterTargetDefaults,
        packageJson
      );
      expect(afterPackageJson).toEqual(['pkg', 'original', 'td']);

      // Layer 3: project.json with spread
      const projectJson = [NX_SPREAD_TOKEN, 'proj'];
      const final = getMergeValueResult(afterPackageJson, projectJson);
      expect(final).toEqual(['pkg', 'original', 'td', 'proj']);
    });

    it('should handle empty base with spread token', () => {
      const base = undefined;
      const newValue = [NX_SPREAD_TOKEN, 'a'];
      const result = getMergeValueResult(base, newValue);
      expect(result).toEqual(['a']);
    });

    it('should handle base with only spread token', () => {
      const base = ['x'];
      const newValue = [NX_SPREAD_TOKEN];
      const result = getMergeValueResult(base, newValue);
      expect(result).toEqual(['x']);
    });
  });

  describe('object spread token merging', () => {
    it('should merge object with spread token', () => {
      const base = { a: 1, b: 2 };
      const newValue = { [NX_SPREAD_TOKEN]: true, c: 3 };
      const result = getMergeValueResult(base, newValue);
      expect(result).toEqual({ a: 1, b: 2, c: 3 });
    });

    it('should override base properties when defined after spread', () => {
      const base = { a: 1, b: 2 };
      const newValue = { [NX_SPREAD_TOKEN]: true, b: 99, c: 3 };
      const result = getMergeValueResult(base, newValue);
      // The order in object iteration matters, but '...' comes first, then b override
      expect(result).toEqual({ a: 1, b: 99, c: 3 });
    });

    it('should handle nested object spread merging', () => {
      // Layer 1
      const base1 = { a: 1 };
      const layer1 = { [NX_SPREAD_TOKEN]: true, b: 2 };
      const afterLayer1 = getMergeValueResult(base1, layer1);
      expect(afterLayer1).toEqual({ a: 1, b: 2 });

      // Layer 2
      const layer2 = { [NX_SPREAD_TOKEN]: true, c: 3 };
      const final = getMergeValueResult(afterLayer1, layer2);
      expect(final).toEqual({ a: 1, b: 2, c: 3 });
    });

    it('should replace object when no spread token present', () => {
      const base = { a: 1, b: 2 };
      const newValue = { c: 3 };
      const result = getMergeValueResult(base, newValue);
      expect(result).toEqual({ c: 3 });
    });
  });

  describe('source map tracking with spread tokens', () => {
    it('should track source information for spread elements', () => {
      const base = ['a', 'b'];
      const newValue = [NX_SPREAD_TOKEN, 'c'];
      const sourceMap: Record<string, [string | null, string]> = {
        inputs: ['base.json', 'base-plugin'],
      };

      const result = getMergeValueResult(base, newValue, {
        sourceMap,
        key: 'inputs',
        sourceInformation: ['new.json', 'new-plugin'],
      });

      expect(result).toEqual(['a', 'b', 'c']);
      expect(sourceMap['inputs']).toEqual(['new.json', 'new-plugin']);
      expect(sourceMap['inputs.0']).toEqual(['base.json', 'base-plugin']);
      expect(sourceMap['inputs.1']).toEqual(['base.json', 'base-plugin']);
      expect(sourceMap['inputs.2']).toEqual(['new.json', 'new-plugin']);
    });

    it('should track source information through nested spread merges', () => {
      const sourceMap: Record<string, [string | null, string]> = {};

      // Layer 1: target defaults
      const base1 = ['a'];
      const layer1 = [NX_SPREAD_TOKEN, 'b'];
      sourceMap['inputs'] = ['original', 'plugin'];

      const afterLayer1 = getMergeValueResult(base1, layer1, {
        sourceMap,
        key: 'inputs',
        sourceInformation: ['target-defaults', 'nx/target-defaults'],
      });
      expect(afterLayer1).toEqual(['a', 'b']);
      expect(sourceMap['inputs.0']).toEqual(['original', 'plugin']);
      expect(sourceMap['inputs.1']).toEqual([
        'target-defaults',
        'nx/target-defaults',
      ]);

      // Layer 2: package.json
      const layer2 = ['c', NX_SPREAD_TOKEN];
      const afterLayer2 = getMergeValueResult(afterLayer1, layer2, {
        sourceMap,
        key: 'inputs',
        sourceInformation: ['package.json', 'nx/package-json'],
      });
      expect(afterLayer2).toEqual(['c', 'a', 'b']);
      expect(sourceMap['inputs.0']).toEqual([
        'package.json',
        'nx/package-json',
      ]);
      // When spreading, source info is updated to the most recent layer that did the spreading
      // The spread elements themselves get the source from afterLayer1's base source (target-defaults)
      expect(sourceMap['inputs.1']).toEqual([
        'target-defaults',
        'nx/target-defaults',
      ]);
      expect(sourceMap['inputs.2']).toEqual([
        'target-defaults',
        'nx/target-defaults',
      ]);
    });

    it('should track source information for object spreads', () => {
      const base = { a: 1, b: 2 };
      const newValue = { [NX_SPREAD_TOKEN]: true, c: 3 };
      const sourceMap: Record<string, [string | null, string]> = {
        options: ['base.json', 'base-plugin'],
      };

      const result = getMergeValueResult(base, newValue, {
        sourceMap,
        key: 'options',
        sourceInformation: ['new.json', 'new-plugin'],
      });

      expect(result).toEqual({ a: 1, b: 2, c: 3 });
      expect(sourceMap['options']).toEqual(['new.json', 'new-plugin']);
      expect(sourceMap['options.a']).toEqual(['base.json', 'base-plugin']);
      expect(sourceMap['options.b']).toEqual(['base.json', 'base-plugin']);
      expect(sourceMap['options.c']).toEqual(['new.json', 'new-plugin']);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined base value', () => {
      const result = getMergeValueResult(undefined, ['a', 'b']);
      expect(result).toEqual(['a', 'b']);
    });

    it('should handle undefined new value', () => {
      const result = getMergeValueResult(['a', 'b'], undefined);
      expect(result).toEqual(['a', 'b']);
    });

    it('should handle null values', () => {
      const result = getMergeValueResult(['a'], null);
      expect(result).toEqual(null);
    });

    it('should handle primitive values', () => {
      const result = getMergeValueResult('old', 'new');
      expect(result).toEqual('new');
    });

    it('should handle type mismatches - object to array', () => {
      const base = { a: 1 };
      const newValue = ['a', 'b'];
      const result = getMergeValueResult(base, newValue);
      expect(result).toEqual(['a', 'b']);
    });

    it('should handle type mismatches - array to object', () => {
      const base = ['a', 'b'];
      const newValue = { a: 1 };
      const result = getMergeValueResult(base, newValue);
      expect(result).toEqual({ a: 1 });
    });

    it('should handle multiple spread tokens in same array', () => {
      const base = ['x', 'y'];
      const newValue = [NX_SPREAD_TOKEN, 'a', NX_SPREAD_TOKEN, 'b'];
      const result = getMergeValueResult(base, newValue);
      // Both spread tokens expand the base array
      expect(result).toEqual(['x', 'y', 'a', 'x', 'y', 'b']);
    });
  });
});
