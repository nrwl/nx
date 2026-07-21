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

describe('suggestion performance', () => {
  it('stays fast when suggesting against a massive workspace', () => {
    // Simulate a very large workspace: thousands of projects, each with a
    // handful of targets, producing tens of thousands of candidate task ids.
    // Target suggestions only run once per failed command, but a huge workspace
    // must not make that computation noticeably slow.
    const targetNames = ['build', 'test', 'lint', 'serve', 'e2e'];
    const candidates: string[] = [];
    for (let i = 0; i < 5000; i++) {
      for (const targetName of targetNames) {
        candidates.push(`project-${i}:${targetName}`);
      }
    }
    expect(candidates.length).toBe(25000);

    const start = performance.now();
    const matches = findClosestMatches('project-1234:biuld', candidates);
    const durationMs = performance.now() - start;

    // Generous bound: the computation is trivial in practice (well under
    // 100ms), so approaching this bound signals a real algorithmic regression
    // rather than a loaded CI machine.
    expect(durationMs).toBeLessThan(2000);
    // Sanity check that it still surfaces the intended task id at scale.
    expect(matches).toContain('project-1234:build');
  });
});
