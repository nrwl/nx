import {
  findMatchingProjects,
  getMatchingStringsWithCache,
} from './find-matching-projects';
import minimatch = require('minimatch');
import type { ProjectGraphProjectNode } from '../config/project-graph';

describe('findMatchingProjects', () => {
  let projectGraph: Record<string, ProjectGraphProjectNode> = {
    'test-project': {
      name: 'test-project',
      type: 'lib',
      data: {
        root: 'lib/test-project',
        tags: ['api', 'theme1'],
      },
    },
    a: {
      name: 'a',
      type: 'lib',
      data: {
        root: 'lib/a',
        tags: ['api', 'theme2'],
      },
    },
    b: {
      name: 'b',
      type: 'lib',
      data: {
        root: 'lib/b',
        tags: ['ui'],
      },
    },
    c: {
      name: 'c',
      type: 'app',
      data: {
        root: 'apps/c',
        tags: ['api'],
      },
    },
    nested: {
      name: 'nested',
      type: 'lib',
      data: {
        root: 'lib/shared/nested',
        tags: [],
      },
    },
  };

  it('should return no projects when passed no patterns', () => {
    expect(findMatchingProjects([], projectGraph)).toEqual([]);
  });

  it('should return no projects when passed empty string', () => {
    expect(findMatchingProjects([''], projectGraph)).toEqual([]);
  });

  it('should not throw when a pattern is empty string', () => {
    expect(findMatchingProjects(['', 'a'], projectGraph)).toEqual(['a']);
  });

  it('should expand "*"', () => {
    expect(findMatchingProjects(['*'], projectGraph)).toEqual([
      'test-project',
      'a',
      'b',
      'c',
      'nested',
    ]);
  });

  it('should support negation "!"', () => {
    expect(findMatchingProjects(['*', '!a'], projectGraph)).toEqual([
      'test-project',
      'b',
      'c',
      'nested',
    ]);
    expect(findMatchingProjects(['!*', 'a'], projectGraph)).toEqual([]);
  });

  it('should expand generic glob patterns', () => {
    const projectGraphMod: typeof projectGraph = {
      ...projectGraph,
      'b-1': {
        name: 'b-1',
        type: 'lib',
        data: {
          root: 'lib/b-1',
          tags: [],
        },
      },
      'b-2': {
        name: 'b-2',
        type: 'lib',
        data: {
          root: 'lib/b-2',
          tags: [],
        },
      },
    };

    expect(findMatchingProjects(['b*'], projectGraphMod)).toEqual([
      'b',
      'b-1',
      'b-2',
    ]);
  });

  it('should support projectNames', () => {
    expect(findMatchingProjects(['a', 'b'], projectGraph)).toEqual(['a', 'b']);
  });

  it('should expand "*" for tags', () => {
    expect(findMatchingProjects(['tag:*'], projectGraph)).toEqual([
      'test-project',
      'a',
      'b',
      'c',
      'nested',
    ]);
  });

  it('should support negation "!" for tags', () => {
    expect(findMatchingProjects(['*', '!tag:api'], projectGraph)).toEqual([
      'b',
      'nested',
    ]);
  });

  it('should expand generic glob patterns for tags', () => {
    expect(findMatchingProjects(['tag:theme*'], projectGraph)).toEqual([
      'test-project',
      'a',
    ]);
  });

  it('should support mixed projectNames and tags', () => {
    expect(findMatchingProjects(['a', 'tag:ui'], projectGraph)).toEqual([
      'a',
      'b',
    ]);
    expect(
      findMatchingProjects(['tag:api', '!tag:theme2'], projectGraph)
    ).toEqual(['test-project', 'c']);
  });

  it('should support glob patterns for project roots', () => {
    expect(findMatchingProjects(['lib/*'], projectGraph)).toEqual([
      'test-project',
      'a',
      'b',
    ]);
    expect(findMatchingProjects(['apps/*'], projectGraph)).toEqual(['c']);
    expect(findMatchingProjects(['**/nested'], projectGraph)).toEqual([
      'nested',
    ]);
  });
});

const projects = [
  'shop-client',
  'shop-api',
  'cart-api',
  'cart-client',
  'shop-ui',
  'cart-ui',
  'shop-e2e',
  'cart-e2e',
];

const roots = projects
  .map((x) => `apps/${x}`)
  .concat(projects.map((x) => `libs/${x}`));

describe.each([
  {
    items: projects,
    pattern: 'cart-*',
  },
  {
    items: projects,
    pattern: '*-ui',
  },
  {
    items: roots,
    pattern: 'libs/*',
  },
])('getMatchingStringsWithCache', ({ items, pattern }) => {
  it(`should be faster than using minimatch directly multiple times (${pattern})`, () => {
    const iterations = 100;
    const cacheTime = time(
      () => getMatchingStringsWithCache(pattern, items),
      iterations
    );
    const directTime = time(() => minimatch.match(items, pattern), iterations);
    // Using minimatch directly takes at least twice as long than using the cache.
    expect(directTime / cacheTime).toBeGreaterThan(2);
  });

  it(`should be comparable to using minimatch a single time (${pattern})`, () => {
    const cacheTime = time(() => getMatchingStringsWithCache(pattern, items));
    const directTime = time(() => minimatch.match(items, pattern));
    // We are dealing with really small file sets here, with such a small
    // difference it time, the system variablility can make this flaky for
    // smaller values. If we are within 1ms, we are good.
    expect(cacheTime).toBeLessThan(directTime + 1);
  });
});

function time(fn: () => void, iterations = 1) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  return performance.now() - start;
}
