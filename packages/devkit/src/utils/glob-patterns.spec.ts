import { splitGlobPatterns } from './glob-patterns';

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
