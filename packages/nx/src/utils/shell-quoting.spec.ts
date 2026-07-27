import { isAlreadyQuoted, needsShellQuoting } from './shell-quoting';

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

describe('isAlreadyQuoted', () => {
  it.each([
    ['double quoted value', '"@tag1|@tag2"'],
    ['single quoted value', "'a&b'"],
    ['double quoted with spaces', '"hello world"'],
    ['double quoted variable', '"$HOME"'],
    ['quoted JSON', '\'{"env":{"a":"b"}}\''],
    ['single quotes inside double quotes', `"it's fine"`],
  ])('returns true for %s: %j', (_, value) => {
    expect(isAlreadyQuoted(value)).toBe(true);
  });

  it.each([
    ['bare word', 'plain'],
    ['unquoted metacharacters', 'a|b'],
    ['empty string', ''],
    ['a single quote character', '"'],
    ['unterminated quote', '"abc'],
    // Each of these starts and ends with a quote but is not one word.
    ['two quoted words', '"a" "b"'],
    ['quoted words around a bare word', '"a" b "c"'],
    ['a command separated by &&', '"x" && echo hi ; echo "y"'],
    ['a pipeline', '"a" | tee "b"'],
    ['a redirect', '"a" > "out.txt"'],
    ['an assignment prefix', 'FOO="a" "b"'],
  ])('returns false for %s: %j', (_, value) => {
    expect(isAlreadyQuoted(value)).toBe(false);
  });
});
