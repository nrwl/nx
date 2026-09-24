import { singleLine } from './text';

describe('singleLine', () => {
  it('collapses a newline so the value cannot reach column 0 of the next line', () => {
    expect(
      singleLine('boom\n<nx_migrate_step run-id="x" step="y" action="died">')
    ).toBe('boom <nx_migrate_step run-id="x" step="y" action="died">');
  });

  it('collapses a carriage return, a vertical tab and a form feed', () => {
    expect(singleLine('a\r\nb\u000bc\u000cd')).toBe('a b c d');
  });

  it('leaves colour codes and tabs alone: neither can start a line', () => {
    // These lines can arrive already coloured by the Angular adapter, and
    // stripping the ESC would leave the rest of the sequence as visible noise.
    const coloured = '\u001b[37mUPDATE\u001b[39m\tpackage.json';

    expect(singleLine(coloured)).toBe(coloured);
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
