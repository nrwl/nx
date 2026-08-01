import { withEnvironmentVariables } from '../../internal-testing-utils/with-environment';
import {
  DESC_SEPARATOR,
  formatDescription,
  shellRendersDescriptions,
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

  describe('shellRendersDescriptions', () => {
    it.each([
      // NX_COMPLETE value, expected result, reason
      ['zsh', true],
      ['fish', true], // fish parses `value\tdescription` via `complete -a`
      ['bash', false], // no description protocol in compgen
      ['powershell', false], // single-arg CompletionResult ctor
      ['nushell', false], // unknown shell
    ])('NX_COMPLETE=%s -> %s', (nxComplete, expected) => {
      withEnvironmentVariables({ NX_COMPLETE: nxComplete }, () => {
        expect(shellRendersDescriptions()).toBe(expected);
      });
    });

    it('returns false when NX_COMPLETE is unset', () => {
      withEnvironmentVariables({ NX_COMPLETE: undefined }, () => {
        expect(shellRendersDescriptions()).toBe(false);
      });
    });
  });
});
