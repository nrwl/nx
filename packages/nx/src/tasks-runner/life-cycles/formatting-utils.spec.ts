import { formatFlags } from './formatting-utils';

describe('formatFlags', () => {
  it('should properly show string values', () => {
    expect(formatFlags('', 'myflag', 'myvalue')).toStrictEqual([
      '  --myflag=myvalue',
    ]);
  });
  it('should properly show number values', () => {
    expect(formatFlags('', 'myflag', 123)).toStrictEqual(['  --myflag=123']);
  });
  it('should properly show boolean values', () => {
    expect(formatFlags('', 'myflag', true)).toStrictEqual(['  --myflag']);
  });
  it('should properly show array values', () => {
    expect(formatFlags('', 'myflag', [1, 23, 'abc'])).toStrictEqual([
      '  --myflag=1',
      '  --myflag=23',
      '  --myflag=abc',
    ]);
  });
  it('should properly show object values', () => {
    expect(
      formatFlags('', 'myflag', { abc: 'def', ghi: { jkl: 42 } })
    ).toStrictEqual(['  --myflag.abc=def', '  --myflag.ghi.jkl=42']);
  });
  it('should not break on invalid inputs', () => {
    expect(formatFlags('', 'myflag', (abc) => abc)).toStrictEqual([
      '  --myflag=(abc) => abc',
    ]);
    expect(formatFlags('', 'myflag', NaN)).toStrictEqual(['  --myflag=NaN']);
  });
  it('should decompose positional values', () => {
    expect(formatFlags('', '_', ['foo', 'bar', 42, 'baz'])).toStrictEqual([
      '  foo bar 42 baz',
    ]);
  });
  it('should handle indentation', () => {
    expect(formatFlags('_____', 'myflag', 'myvalue')).toStrictEqual([
      '_____  --myflag=myvalue',
    ]);
  });
  it('should handle indentation with positionals', () => {
    expect(formatFlags('_____', '_', ['foo', 'bar', 42, 'baz'])).toStrictEqual([
      '_____  foo bar 42 baz',
    ]);
  });
});
