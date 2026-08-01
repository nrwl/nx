import { registerCompletion } from './metadata';
import { tryValueCompletion } from './value-completions';

// argv layout at TAB time: [node, nx-bin, ...shellTokens, currentPartial]
// where shellTokens[0] is the command name as the shell sees it ('nx').
function argv(...userTokens: string[]): string[] {
  return ['node', 'nx-bin', 'nx', ...userTokens];
}

describe('completion/value-completions', () => {
  describe('tryValueCompletion', () => {
    let logSpy: jest.SpyInstance;
    let captured: string[];

    beforeEach(() => {
      captured = [];
      logSpy = jest.spyOn(console, 'log').mockImplementation((line: any) => {
        captured.push(String(line) + '\n');
      });
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    it('returns false when no user tokens follow the script-name', () => {
      expect(tryValueCompletion(['node', 'nx-bin', 'nx'])).toBe(false);
    });

    it('returns false when argv has no shell tokens at all', () => {
      expect(tryValueCompletion(['node', 'nx-bin'])).toBe(false);
    });

    it('emits positional completions for a registered command path', () => {
      registerCompletion('value-cmd', {
        positionals: [{ complete: () => ['proj-a', 'proj-b'] }],
      });
      expect(tryValueCompletion(argv('value-cmd', ''))).toBe(true);
      expect(captured.join('')).toBe('proj-a\nproj-b\n');
    });

    it('filters positional choices by the current partial token', () => {
      registerCompletion('value-choices', {
        positionals: [{ choices: ['inputs', 'outputs', 'lint'] }],
      });
      expect(tryValueCompletion(argv('value-choices', 'in'))).toBe(true);
      expect(captured.join('')).toBe('inputs\n');
    });

    it('dispatches flag-value completions based on the previous token', () => {
      registerCompletion('value-flag', {
        flags: { focus: () => ['my-app', 'my-lib'] },
      });
      expect(tryValueCompletion(argv('value-flag', '--focus', 'my'))).toBe(
        true
      );
      expect(captured.join('')).toBe('my-app\nmy-lib\n');
    });

    it('returns false when no metadata matches (falls through to slow path)', () => {
      expect(tryValueCompletion(argv('nonexistent-unregistered-cmd', ''))).toBe(
        false
      );
      expect(captured).toEqual([]);
    });

    it('treats argv without leading `nx` script-name the same as with it', () => {
      registerCompletion('value-no-nx', {
        positionals: [{ complete: () => ['a'] }],
      });
      // Manual invocations like `NX_COMPLETE=fish nx value-no-nx` don't
      // include 'nx' between the bin and the command name.
      expect(tryValueCompletion(['node', 'nx-bin', 'value-no-nx', ''])).toBe(
        true
      );
      expect(captured.join('')).toBe('a\n');
    });

    it('passes the full tokens array (including the partial) to the completion fn', () => {
      const complete = jest.fn(() => ['x']);
      registerCompletion('value-args', { positionals: [{ complete }] });

      tryValueCompletion(argv('value-args', 'partial'));

      expect(complete).toHaveBeenCalledWith('partial', [
        'value-args',
        'partial',
      ]);
    });
  });
});
