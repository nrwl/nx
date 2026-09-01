import { needsShellQuoting, quoteShellArg } from './shell-quoting';

describe('needsShellQuoting', () => {
  it.each([
    ['pipe', 'a|b'],
    ['ampersand', 'a&b'],
    ['semicolon', 'a;b'],
    ['less than', 'a<b'],
    ['greater than', 'a>b'],
    ['parentheses', '(a)'],
    ['dollar sign', '$var'],
    ['backtick', '`cmd`'],
    ['backslash', 'a\\b'],
    ['double quote', 'say "hi"'],
    ['single quote', "it's"],
    ['asterisk', '*.txt'],
    ['question mark', 'file?.txt'],
    ['square brackets', '[abc]'],
    ['curly braces', '{a,b}'],
    ['tilde', '~/path'],
    ['hash', '#comment'],
    ['exclamation', '!history'],
    ['space', 'hello world'],
    ['tab', 'hello\tworld'],
    ['newline', 'hello\nworld'],
  ])('returns true for %s: %j', (_, value) => {
    expect(needsShellQuoting(value)).toBe(true);
  });

  it.each([
    ['alphanumeric', 'hello123'],
    ['hyphens', 'my-value'],
    ['underscores', 'my_value'],
    ['dots', 'file.txt'],
    ['colons', 'key:value'],
    ['slashes', 'path/to/file'],
    ['at signs', 'user@host'],
    ['equals', 'a=b'],
    ['empty string', ''],
  ])('returns false for %s: %j', (_, value) => {
    expect(needsShellQuoting(value)).toBe(false);
  });
});

describe('quoteShellArg', () => {
  const originalPlatform = process.platform;

  const setPlatform = (platform: NodeJS.Platform) =>
    Object.defineProperty(process, 'platform', { value: platform });

  afterEach(() => {
    setPlatform(originalPlatform);
  });

  it.each([
    ['version', '23.1.0-beta.6'],
    ['flag', '--create-commits'],
    ['flag with plain value', '--run-migrations=migrations.json'],
  ])('leaves %s unquoted: %j', (_, value) => {
    setPlatform('linux');
    expect(quoteShellArg(value)).toBe(value);
    setPlatform('win32');
    expect(quoteShellArg(value)).toBe(value);
  });

  describe('on POSIX', () => {
    beforeEach(() => setPlatform('linux'));

    it.each([
      [
        'spaces and parentheses',
        '--commit-prefix=chore(repo): [nx migration] ',
        `'--commit-prefix=chore(repo): [nx migration] '`,
      ],
      ['dollar sign', 'pre$fix', `'pre$fix'`],
      ['backtick', 'pre`fix', `'pre\`fix'`],
      ['embedded single quote', "it's", `'it'\\''s'`],
      ['embedded double quote', 'say "hi"', `'say "hi"'`],
      ['empty string', '', `''`],
    ])('quotes %s: %j', (_, value, expected) => {
      expect(quoteShellArg(value)).toBe(expected);
    });
  });

  describe('on Windows', () => {
    beforeEach(() => setPlatform('win32'));

    it.each([
      [
        'spaces and parentheses',
        '--commit-prefix=chore(repo): [nx migration] ',
        `"--commit-prefix=chore(repo): [nx migration] "`,
      ],
      ['trailing backslash', 'C:\\dir\\', `"C:\\dir\\\\"`],
      ['caret, which cmd.exe would otherwise eat', 'a^b', `"a^b"`],
      ['empty string', '', `""`],
    ])('quotes %s: %j', (_, value, expected) => {
      expect(quoteShellArg(value)).toBe(expected);
    });

    it.each([
      ['a double quote', 'say "hi"'],
      ['backslashes before a double quote', 'a\\"b'],
      ['a double quote ahead of a command separator', 'x"&whoami&"y'],
    ])('refuses %s: %j', (_, value) => {
      expect(() => quoteShellArg(value)).toThrow(
        'would end the quoting and leave the rest of the argument to be read as commands'
      );
    });

    it.each([
      ['a line feed', 'latest\nwhoami'],
      ['a carriage return', 'latest\rwhoami'],
    ])('refuses %s: %j', (_, value) => {
      expect(() => quoteShellArg(value)).toThrow(
        'would end the command line and leave the rest of the argument to be read as commands'
      );
    });

    it('leaves a percent sign unquoted, since quoting cannot stop %VAR%', () => {
      expect(quoteShellArg('%USERNAME%')).toBe('%USERNAME%');
    });
  });

  // The refusal above is Windows-only because a single-quoted run does hold a
  // line break, so POSIX needs no equivalent.
  it('contains a line break on POSIX, where single quotes hold it', () => {
    setPlatform('linux');
    expect(quoteShellArg('latest\nwhoami')).toBe(`'latest\nwhoami'`);
  });

  it('treats a caret as ordinary text on POSIX, where it has no meaning', () => {
    setPlatform('linux');
    expect(quoteShellArg('a^b')).toBe('a^b');
  });
});
