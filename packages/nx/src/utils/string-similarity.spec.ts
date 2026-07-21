import {
  findClosestMatch,
  findClosestMatches,
  isWithinSuggestionThreshold,
  rankByDistance,
} from './string-similarity';

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

describe('rankByDistance', () => {
  it('sorts candidates by ascending edit distance', () => {
    const ranked = rankByDistance('build', ['built', 'xxxxx', 'build']);

    expect(ranked.map((r) => r.candidate)).toEqual(['build', 'built', 'xxxxx']);
    expect(ranked[0].distance).toBe(0);
  });

  it('breaks ties alphabetically', () => {
    // "serve" and "clean" are both edit distance 5 from "build"; the
    // alphabetical tie-break puts "clean" first regardless of input order.
    const ranked = rankByDistance('build', ['serve', 'clean']);

    expect(ranked.map((r) => r.candidate)).toEqual(['clean', 'serve']);
    expect(ranked[0].distance).toBe(ranked[1].distance);
  });

  it('returns an empty array when there are no candidates', () => {
    expect(rankByDistance('build', [])).toEqual([]);
  });
});

describe('isWithinSuggestionThreshold', () => {
  it('accepts distances up to the length-scaled threshold', () => {
    // "biuld" (length 5) -> threshold = max(2, ceil(5 * 0.4)) = 2.
    expect(isWithinSuggestionThreshold('biuld', 2)).toBe(true);
    expect(isWithinSuggestionThreshold('biuld', 3)).toBe(false);
  });

  it('never drops below a floor of 2 for short inputs', () => {
    // "ab" (length 2) -> ceil(0.8) = 1, but the floor keeps it at 2.
    expect(isWithinSuggestionThreshold('ab', 2)).toBe(true);
  });
});

describe('suggestion performance', () => {
  it('stays fast when ranking against a massive workspace', () => {
    // Simulate a very large workspace: thousands of projects, each with a
    // handful of targets, producing tens of thousands of candidate task ids.
    // Target suggestions only run once per failed command, but a huge workspace
    // must not make ranking (the shared hot path) noticeably slow.
    const targetNames = ['build', 'test', 'lint', 'serve', 'e2e'];
    const candidates: string[] = [];
    for (let i = 0; i < 5000; i++) {
      for (const targetName of targetNames) {
        candidates.push(`project-${i}:${targetName}`);
      }
    }
    expect(candidates.length).toBe(25000);

    const start = performance.now();
    const ranked = rankByDistance('project-1234:biuld', candidates);
    const durationMs = performance.now() - start;

    // Generous bound: the computation is trivial in practice (well under
    // 100ms), so approaching this bound signals a real algorithmic regression
    // rather than a loaded CI machine.
    expect(durationMs).toBeLessThan(2000);
    // Sanity check that the intended task id ranks first at scale.
    expect(ranked[0].candidate).toBe('project-1234:build');
  });
});
