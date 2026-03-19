import { needsShellQuoting } from './shell-quoting';

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
