import {
  filterNonEmptyStrings,
  renderFileEntry,
  renderGitInspectInstruction,
  renderKeyMultilineValue,
  renderListItem,
  stripAnsi,
} from './shared-rendering';

describe('shared-rendering', () => {
  describe('renderFileEntry', () => {
    it('formats as [TYPE] path', () => {
      expect(
        renderFileEntry({ type: 'UPDATE', path: 'apps/foo/file.ts', content: null })
      ).toBe('[UPDATE] apps/foo/file.ts');
    });
  });

  describe('renderListItem', () => {
    it('prefixes the first line with `- ` and indents continuation lines by 2 spaces', () => {
      expect(renderListItem('first line\nsecond\nthird')).toBe(
        '- first line\n  second\n  third'
      );
    });

    it('passes single-line entries through with just the bullet prefix', () => {
      expect(renderListItem('only')).toBe('- only');
    });
  });

  describe('renderKeyMultilineValue', () => {
    it('renders single-line values inline as `key: value`', () => {
      expect(renderKeyMultilineValue('description', 'one line')).toEqual([
        'description: one line',
      ]);
    });

    it('renders multi-line values as a YAML-style block scalar (`key: |`)', () => {
      expect(renderKeyMultilineValue('description', 'one\ntwo\nthree')).toEqual([
        'description: |',
        '  one',
        '  two',
        '  three',
      ]);
    });
  });

  describe('stripAnsi', () => {
    it('removes SGR color codes and reset sequences', () => {
      expect(stripAnsi('\x1b[1m\x1b[33mbold-yellow\x1b[0m')).toBe('bold-yellow');
    });

    it('removes extended CSI sequences terminating in a letter', () => {
      expect(stripAnsi('before\x1b[2Kafter')).toBe('beforeafter');
    });

    it('returns the input unchanged when no escape sequences are present', () => {
      expect(stripAnsi('plain text\nwith newlines')).toBe(
        'plain text\nwith newlines'
      );
    });
  });

  describe('filterNonEmptyStrings', () => {
    it('keeps non-empty strings and drops empty / whitespace / non-string entries', () => {
      expect(
        filterNonEmptyStrings(['valid', '', '   ', null, undefined, 42, 'kept'])
      ).toEqual(['valid', 'kept']);
    });
  });

  describe('renderGitInspectInstruction', () => {
    it('points the agent at the workspace-scoped git commands and explains the working-tree guarantee', () => {
      const out = renderGitInspectInstruction();
      expect(out).toMatch(
        /working tree contains only this migration's contribution/i
      );
      expect(out).toMatch(/git status --porcelain=v1 -uall/);
      expect(out).toMatch(/git diff -- <path>/);
      expect(out).toMatch(/cat <path>/);
    });
  });
});
