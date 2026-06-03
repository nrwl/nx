import { findClosestMatch, findClosestMatches } from './string-similarity';

describe('findClosestMatch', () => {
  it('should return the closest candidate for a small typo', () => {
    expect(findClosestMatch('biuld', ['build', 'serve', 'test'])).toBe('build');
  });

  it('should return the closest candidate for a missing character', () => {
    expect(findClosestMatch('serv', ['build', 'serve', 'test'])).toBe('serve');
  });

  it('should return undefined when nothing is reasonably close', () => {
    expect(findClosestMatch('xyz', ['build', 'serve', 'test'])).toBeUndefined();
  });

  it('should return undefined when there are no candidates', () => {
    expect(findClosestMatch('build', [])).toBeUndefined();
  });

  it('should return an exact match', () => {
    expect(findClosestMatch('build', ['build', 'serve'])).toBe('build');
  });

  it('should prefer the closer of two candidates', () => {
    expect(findClosestMatch('tes', ['test', 'lint'])).toBe('test');
  });
});

describe('findClosestMatches', () => {
  it('should match the right project:target task id despite a project typo', () => {
    expect(
      findClosestMatches('webpai:build', [
        'webapi:build',
        'webapi:serve',
        'other:test',
      ])
    ).toEqual(['webapi:build']);
  });

  it('should return matches sorted by closeness and capped to the limit', () => {
    expect(
      findClosestMatches('buil', ['build', 'built', 'bull', 'xxxx'], 2)
    ).toEqual(['build', 'built']);
  });

  it('should return an empty array when nothing is close enough', () => {
    expect(findClosestMatches('xyz', ['build', 'serve', 'test'])).toEqual([]);
  });

  it('should return an empty array when there are no candidates', () => {
    expect(findClosestMatches('build', [])).toEqual([]);
  });
});
