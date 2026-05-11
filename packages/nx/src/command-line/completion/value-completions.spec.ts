import { registerCompletion } from './metadata';
import { getValueCompletions, tryValueCompletion } from './value-completions';

describe('completion/value-completions', () => {
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = process.argv;
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  describe('tryValueCompletion', () => {
    let originalWrite: typeof process.stdout.write;
    let captured: string[];

    beforeEach(() => {
      originalWrite = process.stdout.write.bind(process.stdout);
      captured = [];
      (process.stdout as any).write = (chunk: any) => {
        captured.push(String(chunk));
        return true;
      };
    });

    afterEach(() => {
      process.stdout.write = originalWrite;
    });

    function setArgv(...userTokens: string[]) {
      process.argv = [
        'node',
        'nx',
        '--get-yargs-completions',
        'nx',
        ...userTokens,
      ];
    }

    it('returns false when --get-yargs-completions is absent', () => {
      process.argv = ['node', 'nx', 'build'];
      expect(tryValueCompletion()).toBe(false);
      expect(captured).toEqual([]);
    });

    it('returns false when no user tokens follow the marker', () => {
      process.argv = ['node', 'nx', '--get-yargs-completions'];
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

    it('returns false when no metadata matches (falls through to fallback)', () => {
      setArgv('nonexistent-unregistered-cmd', '');
      expect(tryValueCompletion()).toBe(false);
      expect(captured).toEqual([]);
    });

    it('treats argv layout without leading `nx` the same as with it', () => {
      registerCompletion('value-no-nx', {
        positionals: [{ complete: () => ['a'] }],
      });
      process.argv = [
        'node',
        'nx',
        '--get-yargs-completions',
        'value-no-nx',
        '',
      ];

      expect(tryValueCompletion()).toBe(true);
      expect(captured.join('')).toBe('a\n');
    });

    it('passes args (without leading `nx`) to the completion fn', () => {
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

  describe('getValueCompletions', () => {
    function setArgv(...tokens: string[]) {
      // Slow-path argv layout includes the marker and the shell tokens; the
      // dispatcher only cares about the trailing-1 entry for `previousToken`.
      process.argv = ['node', 'nx', '--get-yargs-completions', 'nx', ...tokens];
    }

    it('delegates to the positional dispatcher when no flag precedes current', () => {
      registerCompletion('value-callback-pos', {
        positionals: [{ choices: ['inputs', 'outputs'] }],
      });
      setArgv('value-callback-pos', 'in');

      expect(getValueCompletions('in', ['value-callback-pos', 'in'])).toEqual([
        'inputs',
      ]);
    });

    it('reads previousToken from process.argv to dispatch flag handlers', () => {
      const handler = jest.fn(() => ['root']);
      registerCompletion('value-callback-flag', {
        flags: { focus: handler },
      });
      setArgv('value-callback-flag', '--focus', 'r');

      const result = getValueCompletions('r', ['value-callback-flag', 'r']);

      expect(result).toEqual(['root']);
      // args passed to handler match what we gave getValueCompletions, not
      // what argv contains — yargs strips the flag from its parsed `_`.
      expect(handler).toHaveBeenCalledWith('r', ['value-callback-flag', 'r']);
    });

    it('returns null when args are empty', () => {
      setArgv('');
      expect(getValueCompletions('', [])).toBeNull();
    });

    it('returns null when nothing in the metadata registry matches', () => {
      setArgv('unregistered-callback', '');
      expect(getValueCompletions('', ['unregistered-callback', ''])).toBeNull();
    });
  });
});
