import {
  findClosestMatches,
  isWithinSuggestionThreshold,
  rankByDistance,
} from './string-similarity';

describe('findClosestMatches', () => {
  it('should return the closest candidate for a small typo', () => {
    expect(findClosestMatches('biuld', ['build', 'serve', 'test'], 1)).toEqual([
      'build',
    ]);
  });

  it('should return the closest candidate for a missing character', () => {
    expect(findClosestMatches('serv', ['build', 'serve', 'test'], 1)).toEqual([
      'serve',
    ]);
  });

  it('should return nothing when nothing is reasonably close', () => {
    expect(findClosestMatches('xyz', ['build', 'serve', 'test'], 1)).toEqual(
      []
    );
  });

  it('should return an exact match', () => {
    expect(findClosestMatches('build', ['build', 'serve'], 1)).toEqual([
      'build',
    ]);
  });

  it('should prefer the closer of two candidates', () => {
    expect(findClosestMatches('tes', ['test', 'lint'], 1)).toEqual(['test']);
  });

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

  it('should not suggest task ids that differ only in the segment the user typed correctly', () => {
    // "zzz" has nothing in common with any of the projects; the shared ":build"
    // must not buy the project segment a bigger typo budget.
    expect(
      findClosestMatches('zzz:build', ['api:build', 'web:build', 'docs:build'])
    ).toEqual([]);
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
    // "biuld"/"build" share "b" and "ld", leaving 2 differing characters ->
    // threshold = max(2, ceil(2 * 0.4)) = 2.
    expect(isWithinSuggestionThreshold('biuld', 'build', 2)).toBe(true);
    expect(isWithinSuggestionThreshold('biuld', 'build', 3)).toBe(false);
  });

  it('scales the tolerance with the length of the differing part', () => {
    // Nothing is shared at either end, so the whole 18-character input differs
    // -> threshold = max(2, ceil(18 * 0.4)) = 8.
    expect(
      isWithinSuggestionThreshold(
        'documentation-site',
        'legacy-admin-portal',
        8
      )
    ).toBe(true);
    expect(
      isWithinSuggestionThreshold(
        'documentation-site',
        'legacy-admin-portal',
        9
      )
    ).toBe(false);
  });

  it('sizes the tolerance from the differing part, not the whole input', () => {
    // "zzz:build" and "api:build" are 3 edits apart, but only the 3-character
    // project segment differs. Budgeting on the full 9-character length would
    // allow 4 edits and suggest a project with no character in common.
    expect(isWithinSuggestionThreshold('zzz:build', 'api:build', 3)).toBe(
      false
    );
    // Same input, same distance, but now nothing is shared at either end, so
    // the length-scaled tolerance genuinely applies.
    expect(isWithinSuggestionThreshold('zzz:build', 'qwertyuio', 3)).toBe(true);
  });

  it('never drops below a floor of 2 for short inputs', () => {
    // "ab"/"cd" differ over 2 characters -> ceil(0.8) = 1, but the floor keeps
    // it at 2.
    expect(isWithinSuggestionThreshold('ab', 'cd', 2)).toBe(true);
    expect(isWithinSuggestionThreshold('ab', 'cd', 3)).toBe(false);
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

    // Generous bound. The ranking itself takes ~60ms of real work, but under
    // the test runner's transpiled/instrumented execution the same call is
    // measured at ~1s, so the bound has to leave room for that overhead --
    // do not tighten it towards the raw number.
    expect(durationMs).toBeLessThan(2000);
    // Sanity check that the intended task id ranks first at scale.
    expect(ranked[0].candidate).toBe('project-1234:build');
  });
});
