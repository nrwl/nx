import { quoteCmdArg } from './windows-cmd';

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
