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
      ['embedded double quote', 'say "hi"', `"say \\"hi\\""`],
      ['backslashes before a double quote', 'a\\"b', `"a\\\\\\"b"`],
      ['trailing backslash', 'C:\\dir\\', `"C:\\dir\\\\"`],
      ['empty string', '', `""`],
    ])('quotes %s: %j', (_, value, expected) => {
      expect(quoteShellArg(value)).toBe(expected);
    });
  });
});
