import {
  findCompletionMetadata,
  findFlagCompletion,
  registerCompletion,
  resolveCompletion,
} from './metadata';

// `registerCompletion` writes into a module-scoped Map, so tests share a
// registry. We use uniquely-prefixed paths per test to avoid cross-talk.

describe('completion/metadata', () => {
  describe('findCompletionMetadata', () => {
    it('picks the longest matching prefix', () => {
      registerCompletion('meta-test-a', { positionals: [{ choices: ['x'] }] });
      registerCompletion('meta-test-a sub', {
        positionals: [{ choices: ['y'] }],
      });

      const shallow = findCompletionMetadata(['meta-test-a', '']);
      expect(shallow?.metadata.positionals?.[0].choices).toEqual(['x']);

      const deep = findCompletionMetadata(['meta-test-a', 'sub', '']);
      expect(deep?.metadata.positionals?.[0].choices).toEqual(['y']);
    });

    it('stops the prefix walk at the first flag', () => {
      registerCompletion('meta-test-flag-stop', {
        positionals: [{ choices: ['root'] }],
      });

      // The flag should be excluded from the prefix → still matches the path.
      const match = findCompletionMetadata([
        'meta-test-flag-stop',
        '--focus',
        'something',
      ]);
      expect(match?.metadata.positionals?.[0].choices).toEqual(['root']);
    });

    it('returns the positional index relative to the typed-past tokens', () => {
      registerCompletion('meta-test-pos', { positionals: [{ choices: ['a'] }] });

      // args = [cmd, partial] → 0 typed past the path → positional 0.
      expect(findCompletionMetadata(['meta-test-pos', ''])?.positionalIndex).toBe(
        0
      );
      // args = [cmd, first, partial] → 1 typed past → positional 1.
      expect(
        findCompletionMetadata(['meta-test-pos', 'first', ''])?.positionalIndex
      ).toBe(1);
    });

    it('returns null when no path matches', () => {
      expect(findCompletionMetadata(['unregistered-xyz', ''])).toBeNull();
    });
  });

  describe('findFlagCompletion', () => {
    it('returns the registered handler', () => {
      const handler = jest.fn(() => ['ok']);
      registerCompletion('meta-test-flag', { flags: { focus: handler } });
      const meta = findCompletionMetadata(['meta-test-flag', ''])!.metadata;

      expect(findFlagCompletion(meta, 'focus')).toBe(handler);
    });

    it('returns null for unknown or missing metadata', () => {
      registerCompletion('meta-test-flag-2', { flags: {} });
      const meta = findCompletionMetadata(['meta-test-flag-2', ''])!.metadata;

      expect(findFlagCompletion(meta, 'unknown')).toBeNull();
      expect(findFlagCompletion(null, 'anything')).toBeNull();
    });
  });

  describe('resolveCompletion', () => {
    it('dispatches a positional `complete` fn with current + args', () => {
      const complete = jest.fn(() => ['proj-a', 'proj-b']);
      registerCompletion('meta-test-resolve-pos', {
        positionals: [{ complete }],
      });

      const result = resolveCompletion(
        ['meta-test-resolve-pos', 'pro'],
        'pro',
        'meta-test-resolve-pos'
      );

      expect(result).toEqual(['proj-a', 'proj-b']);
      expect(complete).toHaveBeenCalledWith('pro', [
        'meta-test-resolve-pos',
        'pro',
      ]);
    });

    it('filters positional `choices` by the current prefix', () => {
      registerCompletion('meta-test-resolve-choices', {
        positionals: [{ choices: ['inputs', 'outputs', 'config'] }],
      });

      expect(
        resolveCompletion(
          ['meta-test-resolve-choices', 'in'],
          'in',
          'meta-test-resolve-choices'
        )
      ).toEqual(['inputs']);
    });

    it('dispatches a flag handler when previousToken is a flag', () => {
      const handler = jest.fn(() => ['root', 'lib']);
      registerCompletion('meta-test-resolve-flag', {
        flags: { focus: handler },
      });

      const result = resolveCompletion(
        ['meta-test-resolve-flag', '--focus', 'r'],
        'r',
        '--focus'
      );

      expect(result).toEqual(['root', 'lib']);
      expect(handler).toHaveBeenCalledWith('r', [
        'meta-test-resolve-flag',
        '--focus',
        'r',
      ]);
    });

    it('flag dispatch takes precedence over positionals', () => {
      const flag = jest.fn(() => ['from-flag']);
      const positional = jest.fn(() => ['from-positional']);
      registerCompletion('meta-test-resolve-precedence', {
        positionals: [{ complete: positional }],
        flags: { focus: flag },
      });

      const result = resolveCompletion(
        ['meta-test-resolve-precedence', '--focus', ''],
        '',
        '--focus'
      );

      expect(result).toEqual(['from-flag']);
      expect(positional).not.toHaveBeenCalled();
    });

    it('falls through to positional when previousToken is a flag with no handler', () => {
      const positional = jest.fn(() => ['x']);
      registerCompletion('meta-test-resolve-flag-fallthrough', {
        positionals: [{ complete: positional }],
        flags: {},
      });

      const result = resolveCompletion(
        ['meta-test-resolve-flag-fallthrough', '--unknown', ''],
        '',
        '--unknown'
      );

      // Empty `nonFlag` chain past the path means positional 0 still matches.
      expect(result).toEqual(['x']);
    });

    it('returns null for empty args', () => {
      expect(resolveCompletion([], '', '')).toBeNull();
    });

    it('returns null when no metadata path matches', () => {
      expect(
        resolveCompletion(['unregistered-resolve', ''], '', '')
      ).toBeNull();
    });

    it('returns null past the declared positionals', () => {
      registerCompletion('meta-test-resolve-past', {
        positionals: [{ choices: ['only'] }],
      });

      // Two typed-past tokens means positional index 1, which is undeclared.
      expect(
        resolveCompletion(
          ['meta-test-resolve-past', 'only', ''],
          '',
          'only'
        )
      ).toBeNull();
    });
  });
});
