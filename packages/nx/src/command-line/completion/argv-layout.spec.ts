import { parseCompletionArgs } from './argv-layout';

describe('completion/argv-layout', () => {
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = process.argv;
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  describe('parseCompletionArgs', () => {
    it('strips [node, nx-bin] and the leading `nx` script-name token', () => {
      process.argv = ['node', 'nx-bin', 'nx', 'run-many', '-p', ''];
      expect(parseCompletionArgs()).toEqual({
        tokens: ['run-many', '-p', ''],
        current: '',
        previousToken: '-p',
      });
    });

    it('handles a layout without the leading `nx` script-name', () => {
      // The wrappers always include `nx`, but manual invocations like
      // `NX_COMPLETE=fish nx run-many` don't — keep dev iteration usable.
      process.argv = ['node', 'nx-bin', 'run-many', ''];
      expect(parseCompletionArgs()).toEqual({
        tokens: ['run-many', ''],
        current: '',
        previousToken: 'run-many',
      });
    });

    it('exposes the partial being typed as `current`', () => {
      process.argv = ['node', 'nx-bin', 'nx', 'generate', '@nx/js:lib'];
      const parsed = parseCompletionArgs();
      expect(parsed?.current).toBe('@nx/js:lib');
    });

    it('reports an empty previousToken when only one token follows `nx`', () => {
      process.argv = ['node', 'nx-bin', 'nx', 'generate'];
      const parsed = parseCompletionArgs();
      expect(parsed?.tokens).toEqual(['generate']);
      expect(parsed?.previousToken).toBe('');
    });

    it('reports previousToken so flag-value completion can dispatch', () => {
      process.argv = ['node', 'nx-bin', 'nx', 'graph', '--focus', 'my'];
      const parsed = parseCompletionArgs();
      expect(parsed?.current).toBe('my');
      expect(parsed?.previousToken).toBe('--focus');
    });

    it('returns null when no tokens follow the script-name', () => {
      process.argv = ['node', 'nx-bin', 'nx'];
      expect(parseCompletionArgs()).toBeNull();
    });

    it('returns null when argv has no shell tokens at all', () => {
      process.argv = ['node', 'nx-bin'];
      expect(parseCompletionArgs()).toBeNull();
    });
  });
});
