import {
  expandGlobPatternBraces,
  isGlobPattern,
  splitGlobPatterns,
} from './globs';

describe('isGlobPattern', () => {
  it.each([
    [true, '{a,b}'],
    [true, 'a*'],
    [false, 'some-project'],
  ])('should return %s for %s', (expected, pattern) => {
    expect(isGlobPattern(pattern)).toBe(expected);
  });
});

describe('splitGlobPatterns', () => {
  it.each([
    [
      ['**/project.json', '**/package.json'],
      '{**/project.json,**/package.json}',
    ],
    [
      ['**/tsconfig*{.json,.*.json}', '**/x'],
      '{**/tsconfig*{.json,.*.json},**/x}',
    ],
    [['**/*.ts'], '**/*.ts'],
    [['{a,b}/c'], '{a,b}/c'],
    [['{a,b}/{c,d}'], '{a,b}/{c,d}'],
    [['{a,{b}'], '{a,{b}'],
    [['a', 'b'], '{a,b}'],
    [[''], ''],
  ])('should return %j for %s', (expected, pattern) => {
    expect(splitGlobPatterns(pattern)).toEqual(expected);
  });
});

describe('expandGlobPatternBraces', () => {
  it.each([
    [['libs/a/**/*.ts', 'libs/a/**/*.tsx'], 'libs/a/{**/*.ts,**/*.tsx}'],
    [['a/c', 'b/c'], '{a,b}/c'],
    [['a/c', 'a/d', 'b/c', 'b/d'], '{a,b}/{c,d}'],
    [['**/*.ts'], '**/*.ts'],
    [['x/{1..3}/y'], 'x/{1..3}/y'],
    [['{a,{b}'], '{a,{b}'],
    [['x/a.json', 'x/b{c}d.json'], 'x/{a,b{c}d}.json'],
    [[''], ''],
  ])('should return %j for %s', (expected, pattern) => {
    expect(expandGlobPatternBraces(pattern)).toEqual(expected);
  });
});
