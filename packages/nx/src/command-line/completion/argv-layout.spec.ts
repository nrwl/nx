import { parseCompletionArgs } from './argv-layout';

describe('completion/argv-layout', () => {
  describe('parseCompletionArgs', () => {
    it('strips [node, nx-bin] and the leading `nx` script-name token', () => {
      expect(
        parseCompletionArgs(['node', 'nx-bin', 'nx', 'run-many', '-p', ''])
      ).toEqual({
        tokens: ['run-many', '-p', ''],
        current: '',
        previousToken: '-p',
      });
    });

    it('handles a layout without the leading `nx` script-name', () => {
      // The wrappers always include `nx`, but manual invocations like
      // `NX_COMPLETE=fish nx run-many` don't — keep dev iteration usable.
      expect(parseCompletionArgs(['node', 'nx-bin', 'run-many', ''])).toEqual({
        tokens: ['run-many', ''],
        current: '',
        previousToken: 'run-many',
      });
    });

    it('exposes the partial being typed as `current`', () => {
      const parsed = parseCompletionArgs([
        'node',
        'nx-bin',
        'nx',
        'generate',
        '@nx/js:lib',
      ]);
      expect(parsed?.current).toBe('@nx/js:lib');
    });

    it('reports an empty previousToken when only one token follows `nx`', () => {
      const parsed = parseCompletionArgs(['node', 'nx-bin', 'nx', 'generate']);
      expect(parsed?.tokens).toEqual(['generate']);
      expect(parsed?.previousToken).toBe('');
    });

    it('reports previousToken so flag-value completion can dispatch', () => {
      const parsed = parseCompletionArgs([
        'node',
        'nx-bin',
        'nx',
        'graph',
        '--focus',
        'my',
      ]);
      expect(parsed?.current).toBe('my');
      expect(parsed?.previousToken).toBe('--focus');
    });

    it('returns null when no tokens follow the script-name', () => {
      expect(parseCompletionArgs(['node', 'nx-bin', 'nx'])).toBeNull();
    });

    it('returns null when argv has no shell tokens at all', () => {
      expect(parseCompletionArgs(['node', 'nx-bin'])).toBeNull();
    });
  });
});
