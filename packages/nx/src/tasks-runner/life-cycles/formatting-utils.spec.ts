import { formatFlags } from './formatting-utils';

describe('formatFlags', () => {
  it('should properly show string values', () => {
    expect(formatFlags('', 'myflag', 'myvalue')).toBe('  --myflag=myvalue');
  });
  it('should properly show number values', () => {
    expect(formatFlags('', 'myflag', 123)).toBe('  --myflag=123');
  });
  it('should properly show boolean values', () => {
    expect(formatFlags('', 'myflag', true)).toBe('  --myflag=true');
  });
  it('should properly show array values', () => {
    expect(formatFlags('', 'myflag', [1, 23, 'abc'])).toBe(
      '  --myflag=[1,23,abc]'
    );
  });
  it('should properly show object values', () => {
    expect(formatFlags('', 'myflag', { abc: 'def', ghi: { jkl: 42 } })).toBe(
      '  --myflag={"abc":"def","ghi":{"jkl":42}}'
    );
  });
  it('should not break on invalid inputs', () => {
    expect(formatFlags('', 'myflag', (abc) => abc)).toBe(
      '  --myflag=(abc) => abc'
    );
    expect(formatFlags('', 'myflag', NaN)).toBe('  --myflag=NaN');
  });
  it('should decompose positional values', () => {
    expect(formatFlags('', '_', ['foo', 'bar', 42, 'baz'])).toBe(
      '  foo bar 42 baz'
    );
  });
  it('should handle indentation', () => {
    expect(formatFlags('_____', 'myflag', 'myvalue')).toBe(
      '_____  --myflag=myvalue'
    );
  });
  it('should handle indentation with positionals', () => {
    expect(formatFlags('_____', '_', ['foo', 'bar', 42, 'baz'])).toBe(
      '_____  foo bar 42 baz'
    );
  });
});
