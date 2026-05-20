import { registerCompletion } from './metadata';
import { tryValueCompletion } from './value-completions';

describe('completion/value-completions', () => {
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = process.argv;
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

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

    // argv layout at TAB time: [node, nx-bin, ...shellTokens, currentPartial]
    // where shellTokens[0] is the command name as the shell sees it ('nx').
    function setArgv(...userTokens: string[]) {
      process.argv = ['node', 'nx-bin', 'nx', ...userTokens];
    }

    it('returns false when no user tokens follow the script-name', () => {
      process.argv = ['node', 'nx-bin', 'nx'];
      expect(tryValueCompletion()).toBe(false);
    });

    it('returns false when argv has no shell tokens at all', () => {
      process.argv = ['node', 'nx-bin'];
      expect(tryValueCompletion()).toBe(false);
    });

    it('emits positional completions for a registered command path', () => {
      registerCompletion('value-cmd', {
        positionals: [{ complete: () => ['proj-a', 'proj-b'] }],
      });
      setArgv('value-cmd', '');

      expect(tryValueCompletion()).toBe(true);
      expect(captured.join('')).toBe('proj-a\nproj-b\n');
    });

    it('filters positional choices by the current partial token', () => {
      registerCompletion('value-choices', {
        positionals: [{ choices: ['inputs', 'outputs', 'lint'] }],
      });
      setArgv('value-choices', 'in');

      expect(tryValueCompletion()).toBe(true);
      expect(captured.join('')).toBe('inputs\n');
    });

    it('dispatches flag-value completions based on the previous token', () => {
      registerCompletion('value-flag', {
        flags: { focus: () => ['my-app', 'my-lib'] },
      });
      setArgv('value-flag', '--focus', 'my');

      expect(tryValueCompletion()).toBe(true);
      expect(captured.join('')).toBe('my-app\nmy-lib\n');
    });

    it('returns false when no metadata matches (falls through to slow path)', () => {
      setArgv('nonexistent-unregistered-cmd', '');
      expect(tryValueCompletion()).toBe(false);
      expect(captured).toEqual([]);
    });

    it('returns false when argv is missing the leading `nx` script-name', () => {
      // Wrappers always include `nx`; anything else is a malformed call.
      registerCompletion('value-no-nx', {
        positionals: [{ complete: () => ['a'] }],
      });
      process.argv = ['node', 'nx-bin', 'value-no-nx', ''];

      expect(tryValueCompletion()).toBe(false);
      expect(captured.join('')).toBe('');
    });

    it('passes the full tokens array (including the partial) to the completion fn', () => {
      const complete = jest.fn(() => ['x']);
      registerCompletion('value-args', { positionals: [{ complete }] });
      setArgv('value-args', 'partial');

      tryValueCompletion();

      expect(complete).toHaveBeenCalledWith('partial', [
        'value-args',
        'partial',
      ]);
    });
  });
});
