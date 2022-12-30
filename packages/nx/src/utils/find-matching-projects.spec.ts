import { findMatchingProjects } from './find-matching-projects';

describe('findMatchingProjects', () => {
  let projectsSet: Set<string>;

  beforeEach(() => {
    projectsSet = new Set(['test-project', 'a', 'b', 'c']);
  });

  it('should expand "*"', () => {
    expect(
      findMatchingProjects(['*'], Array.from(projectsSet), projectsSet)
    ).toEqual(['test-project', 'a', 'b', 'c']);
  });

  it('should expand generic glob patterns', () => {
    projectsSet.add('b-1');
    projectsSet.add('b-2');

    expect(
      findMatchingProjects(['b*'], Array.from(projectsSet), projectsSet)
    ).toEqual(['b', 'b-1', 'b-2']);
  });

  it('should support projectNames', () => {
    expect(
      findMatchingProjects(['a', 'b'], Array.from(projectsSet), projectsSet)
    ).toEqual(['a', 'b']);
  });
});
