import { isGlobPattern } from './globs';

describe('isGlobPattern', () => {
  it.each([
    [true, '{a,b}'],
    [true, 'a*'],
    [false, 'some-project'],
  ])('should return %s for %s', (expected, pattern) => {
    expect(isGlobPattern(pattern)).toBe(expected);
  });
});
