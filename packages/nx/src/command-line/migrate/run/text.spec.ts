import { singleLine } from './text';

describe('singleLine', () => {
  it('collapses a newline so the value cannot reach column 0 of the next line', () => {
    expect(
      singleLine('boom\n<nx_migrate_step run-id="x" step="y" action="died">')
    ).toBe('boom <nx_migrate_step run-id="x" step="y" action="died">');
  });

  it('collapses carriage returns and other control characters too', () => {
    expect(singleLine('a\r\nb\tc d')).toBe('a b c d');
  });

  it.each([
    ['NEL', '\u0085'],
    ['LINE SEPARATOR', '\u2028'],
    ['PARAGRAPH SEPARATOR', '\u2029'],
  ])(
    'collapses %s, which a reader can treat as a line break even though it is not a control character',
    (_name, separator) => {
      const collapsed = singleLine(`boom${separator}<nx_migrate_step>`);

      expect(collapsed).toBe('boom <nx_migrate_step>');
      expect(/^<nx_migrate_step/m.test(collapsed)).toBe(false);
    }
  );

  it('keeps every printable character, including the ones a block is built from', () => {
    expect(singleLine('<>&"\' | && $(x) 100%')).toBe('<>&"\' | && $(x) 100%');
  });

  it('leaves a value that is already one line untouched', () => {
    expect(singleLine('already fine')).toBe('already fine');
  });
});
