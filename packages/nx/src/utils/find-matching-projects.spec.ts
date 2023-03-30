import { findMatchingProjects } from './find-matching-projects';
import { type ProjectGraphProjectNode } from '../config/project-graph';

describe('findMatchingProjects', () => {
  let projectGraph: Record<string, ProjectGraphProjectNode> = {
    'test-project': {
      name: 'test-project',
      type: 'lib',
      data: {
        root: 'lib/test-project',
        files: [],
        tags: ['api', 'theme1'],
      },
    },
    a: {
      name: 'a',
      type: 'lib',
      data: {
        root: 'lib/a',
        files: [],
        tags: ['api', 'theme2'],
      },
    },
    b: {
      name: 'b',
      type: 'lib',
      data: {
        root: 'lib/b',
        files: [],
        tags: ['ui'],
      },
    },
    c: {
      name: 'c',
      type: 'lib',
      data: {
        root: 'lib/c',
        files: [],
        tags: ['api'],
      },
    },
  };

  it('should expand "*"', () => {
    expect(findMatchingProjects(['*'], projectGraph)).toEqual([
      'test-project',
      'a',
      'b',
      'c',
    ]);
  });

  it('should support negation "!"', () => {
    expect(findMatchingProjects(['*', '!a'], projectGraph)).toEqual([
      'test-project',
      'b',
      'c',
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
          files: [],
          tags: [],
        },
      },
      'b-2': {
        name: 'b-2',
        type: 'lib',
        data: {
          root: 'lib/b-2',
          files: [],
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
    expect(findMatchingProjects(['tags:*'], projectGraph)).toEqual([
      'test-project',
      'a',
      'b',
      'c',
    ]);
  });

  it('should support negation "!" for tags', () => {
    expect(findMatchingProjects(['*', 'tag:!api'], projectGraph)).toEqual([
      'b',
    ]);
    expect(findMatchingProjects(['*', '!tag:api'], projectGraph)).toEqual([
      'b',
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
});
