import { serializeOverridesIntoCommandLine } from './serialize-overrides-into-command-line';

describe('serializeOverridesIntoCommandLine', () => {
  it('should serialize simple key-value pairs', () => {
    expect(serializeOverridesIntoCommandLine({ key: 'value' })).toEqual([
      '--key=value',
    ]);
  });

  it('should serialize boolean true as flag', () => {
    expect(serializeOverridesIntoCommandLine({ verbose: true })).toEqual([
      '--verbose',
    ]);
  });

  it('should serialize boolean false as --no-flag', () => {
    expect(serializeOverridesIntoCommandLine({ verbose: false })).toEqual([
      '--no-verbose',
    ]);
  });

  it('should serialize arrays as multiple flags', () => {
    expect(
      serializeOverridesIntoCommandLine({ include: ['a', 'b', 'c'] })
    ).toEqual(['--include=a', '--include=b', '--include=c']);
  });

  it('should flatten nested objects', () => {
    expect(
      serializeOverridesIntoCommandLine({ env: { foo: 'bar', baz: 'qux' } })
    ).toEqual(['--env.foo=bar', '--env.baz=qux']);
  });

  it('should preserve positional arguments from _', () => {
    expect(serializeOverridesIntoCommandLine({ _: ['pos1', 'pos2'] })).toEqual([
      'pos1',
      'pos2',
    ]);
  });

  describe('shell metacharacter quoting', () => {
    it.each([
      ['spaces', 'hello world', '--key="hello world"'],
      ['pipe (|)', '@tag1|@tag2', '--key="@tag1|@tag2"'],
      ['ampersand (&)', 'a&b', '--key="a&b"'],
      ['dollar sign ($)', '$HOME/dir', '--key="$HOME/dir"'],
      ['semicolon (;)', 'echo;ls', '--key="echo;ls"'],
      ['parentheses', '(a+b)', '--key="(a+b)"'],
      ['asterisk (*)', '*.txt', '--key="*.txt"'],
      ['backtick (`)', '`pwd`', '--key="`pwd`"'],
      ['angle brackets (>)', 'a>b', '--key="a>b"'],
      ['question mark (?)', 'file?.txt', '--key="file?.txt"'],
      ['square brackets ([])', '[abc].txt', '--key="[abc].txt"'],
      ['hash (#)', '#important', '--key="#important"'],
      ['tilde (~)', '~/documents', '--key="~/documents"'],
      ['embedded double quotes', 'hello "world"', '--key="hello \\"world\\""'],
      ['newline', 'hello\nworld', '--key="hello\nworld"'],
      ['tab', 'hello\tworld', '--key="hello\tworld"'],
    ])('should wrap values with %s in quotes', (_, value, expected) => {
      expect(serializeOverridesIntoCommandLine({ key: value })).toEqual([
        expected,
      ]);
    });

    it('should not re-quote single-quoted values', () => {
      expect(
        serializeOverridesIntoCommandLine({
          config: '\'{"env":{"cliArg":"i am from the cli args"}}\'',
        })
      ).toEqual(['--config=\'{"env":{"cliArg":"i am from the cli args"}}\'']);
    });

    it('should not re-quote double-quoted values', () => {
      expect(
        serializeOverridesIntoCommandLine({
          config: '"some value with spaces"',
        })
      ).toEqual(['--config="some value with spaces"']);
    });

    it('should not wrap values without special characters', () => {
      expect(serializeOverridesIntoCommandLine({ key: 'simplevalue' })).toEqual(
        ['--key=simplevalue']
      );
    });
  });
});
