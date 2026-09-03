import { caretEscape, neutralizePercent, quoteCmdArg } from './windows-cmd';

describe('quoteCmdArg', () => {
  it.each<[string, string]>([
    ['plain', '"plain"'],
    ['has space', '"has space"'],
    ['say "hi"', '"say \\"hi\\""'],
    ['back\\"slash', '"back\\\\\\"slash"'],
    ['trailing\\', '"trailing\\\\"'],
    ['', '""'],
  ])('quotes %j as %s', (input, expected) => {
    expect(quoteCmdArg(input)).toBe(expected);
  });
});

describe('caretEscape', () => {
  it('escapes cmd.exe metacharacters and leaves % alone', () => {
    expect(caretEscape('"a b(c)|d%e!"')).toBe('^"a^ b^(c^)^|d%e^!^"');
  });
});

describe('neutralizePercent', () => {
  it('turns each % into a zero-length substring expansion that leaves it literal', () => {
    expect(neutralizePercent('100%')).toBe('100%%cd:~,%');
  });

  it('keeps the comma it introduces uncareted after caretEscape', () => {
    expect(neutralizePercent(caretEscape(quoteCmdArg('50%,')))).toBe(
      '^"50%%cd:~,%^,^"'
    );
  });
});
