import {
  DESC_SEPARATOR,
  formatDescription,
  isZshShell,
} from './command-completions';

// `getCommandCompletions` and `getTopLevelCommands` aren't unit-tested:
// both lazy-require the full nx-commands surface (35+ command-objects),
// which defeats the point of having a value-completion fast path they
// live alongside. The behavior is exercised end-to-end in shell
// integration runs.

describe('completion/command-completions', () => {
  describe('DESC_SEPARATOR', () => {
    // The zsh wrapper splits each completion line on this separator. It MUST
    // be a TAB — completion values (`my-app:build`) and command names
    // (`format:check`) contain colons, so a colon separator is ambiguous.
    it('is a TAB', () => {
      expect(DESC_SEPARATOR).toBe('\t');
    });
  });

  describe('formatDescription', () => {
    it('strips the yargs i18n marker prefix', () => {
      expect(formatDescription('__yargsString__:Run a target')).toBe(
        'Run a target'
      );
    });

    it('leaves colons untouched (the value/description separator is a TAB)', () => {
      expect(formatDescription('See more: nx.dev')).toBe('See more: nx.dev');
    });

    it('handles undefined and empty inputs', () => {
      expect(formatDescription(undefined)).toBe('');
      expect(formatDescription('')).toBe('');
    });

    it('strips only the marker, keeping a colon in the description', () => {
      expect(formatDescription('__yargsString__:Prefix: do thing')).toBe(
        'Prefix: do thing'
      );
    });

    it('collapses literal TABs so they cannot break the zsh value/desc split', () => {
      expect(formatDescription('see\tthe\tdocs')).toBe('see the docs');
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
