import { WholeFileChange } from '../../file-utils';
import { getTouchedProjects } from './workspace-projects';

describe('getTouchedProjects', () => {
  it('should return a list of projects for the given changes', () => {
    const fileChanges = [
      {
        file: 'libs/a/index.ts',
        ext: '.ts',
        hash: 'some-hash',
        getChanges: () => [new WholeFileChange()],
      },
      {
        file: 'libs/b/index.ts',
        ext: '.ts',
        hash: 'some-hash',
        getChanges: () => [new WholeFileChange()],
      },
    ];
    const projects = {
      a: { root: 'libs/a' },
      b: { root: 'libs/b' },
      c: { root: 'libs/c' },
    };
    expect(getTouchedProjects(fileChanges, { projects })).toEqual(['a', 'b']);
  });

  it('should return projects with the root matching a whole directory name in the file path', () => {
    const fileChanges = [
      {
        file: 'libs/a-b/index.ts',
        ext: '.ts',
        hash: 'some-hash',
        getChanges: () => [new WholeFileChange()],
      },
    ];
    const projects = {
      a: { root: 'libs/a' },
      abc: { root: 'libs/a-b-c' },
      ab: { root: 'libs/a-b' },
    };
    expect(getTouchedProjects(fileChanges, { projects })).toEqual(['ab']);
  });

  it('should return projects with the root matching a whole directory name in the file path', () => {
    const fileChanges = [
      {
        file: 'libs/a-b/index.ts',
        ext: '.ts',
        hash: 'some-hash',
        getChanges: () => [new WholeFileChange()],
      },
    ];
    const projects = {
      aaaaa: { root: 'libs/a' },
      abc: { root: 'libs/a-b-c' },
      ab: { root: 'libs/a-b' },
    };
    expect(getTouchedProjects(fileChanges, { projects })).toEqual(['ab']);
  });

  it('should return the most qualifying match with the file path', () => {
    const fileChanges = [
      {
        file: 'libs/a/b/index.ts',
        ext: '.ts',
        hash: 'some-hash',
        getChanges: () => [new WholeFileChange()],
      },
    ];
    const projects = {
      aaaaa: { root: 'libs/a' },
      ab: { root: 'libs/a/b' },
    };
    expect(getTouchedProjects(fileChanges, { projects })).toEqual(['ab']);
  });
});
