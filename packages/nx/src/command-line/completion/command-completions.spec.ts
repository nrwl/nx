import { formatDescription, isZshShell } from './command-completions';

// `getCommandCompletions` itself isn't unit-tested: it lazy-requires the
// full nx-commands surface (35+ command-objects), which defeats the point
// of having a value-completion fast path it lives alongside. The behavior
// is exercised end-to-end in shell integration runs.

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
    let originalShell: string | undefined;
    let originalZshName: string | undefined;

    beforeEach(() => {
      originalShell = process.env.SHELL;
      originalZshName = process.env.ZSH_NAME;
    });

    afterEach(() => {
      restoreEnv('SHELL', originalShell);
      restoreEnv('ZSH_NAME', originalZshName);
    });

    it('returns true when SHELL contains zsh', () => {
      process.env.SHELL = '/usr/bin/zsh';
      delete process.env.ZSH_NAME;
      expect(isZshShell()).toBe(true);
    });

    it('returns true when ZSH_NAME contains zsh', () => {
      delete process.env.SHELL;
      process.env.ZSH_NAME = 'zsh';
      expect(isZshShell()).toBe(true);
    });

    it('returns false when neither env var indicates zsh', () => {
      process.env.SHELL = '/bin/bash';
      delete process.env.ZSH_NAME;
      expect(isZshShell()).toBe(false);
    });

    it('returns false when both env vars are unset', () => {
      delete process.env.SHELL;
      delete process.env.ZSH_NAME;
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
