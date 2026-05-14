import { formatDescription, isZshShell } from './command-completions';

// `getCommandCompletions` and `getTopLevelCommands` aren't unit-tested:
// both lazy-require the full nx-commands surface (35+ command-objects),
// which defeats the point of having a value-completion fast path they
// live alongside. The behavior is exercised end-to-end in shell
// integration runs.

describe('completion/command-completions', () => {
  describe('formatDescription', () => {
    it('strips the yargs i18n marker prefix', () => {
      expect(formatDescription('__yargsString__:Run a target')).toBe(
        'Run a target'
      );
    });

    it('escapes literal colons so they do not break the name:desc format', () => {
      expect(formatDescription('See more: nx.dev')).toBe('See more\\: nx.dev');
    });

    it('handles undefined and empty inputs', () => {
      expect(formatDescription(undefined)).toBe('');
      expect(formatDescription('')).toBe('');
    });

    it('combines marker-strip and colon-escape', () => {
      expect(formatDescription('__yargsString__:Prefix: do thing')).toBe(
        'Prefix\\: do thing'
      );
    });
  });

  describe('isZshShell', () => {
    let originalNxComplete: string | undefined;

    beforeEach(() => {
      originalNxComplete = process.env.NX_COMPLETE;
    });

    afterEach(() => {
      restoreEnv('NX_COMPLETE', originalNxComplete);
    });

    it('returns true when NX_COMPLETE is zsh', () => {
      process.env.NX_COMPLETE = 'zsh';
      expect(isZshShell()).toBe(true);
    });

    it('returns false when NX_COMPLETE is a different shell', () => {
      process.env.NX_COMPLETE = 'bash';
      expect(isZshShell()).toBe(false);
    });

    it('returns false when NX_COMPLETE is unset', () => {
      delete process.env.NX_COMPLETE;
      expect(isZshShell()).toBe(false);
    });

    it('returns false when NX_COMPLETE is an unknown shell', () => {
      process.env.NX_COMPLETE = 'nushell';
      expect(isZshShell()).toBe(false);
    });
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
