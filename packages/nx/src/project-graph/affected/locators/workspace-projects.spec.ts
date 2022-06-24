import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from 'nx/src/config/project-graph';
import { ProjectConfiguration } from 'nx/src/config/workspace-json-project-json';
import { WholeFileChange } from '../../file-utils';
import {
  getTouchedProjects,
  getImplicitlyTouchedProjects,
} from './workspace-projects';

function getFileChanges(files: string[]) {
  return files.map((f) => ({
    file: f,
    hash: 'some-hash',
    getChanges: () => [new WholeFileChange()],
  }));
}

describe('getTouchedProjects', () => {
  it('should return a list of projects for the given changes', () => {
    const fileChanges = getFileChanges(['libs/a/index.ts', 'libs/b/index.ts']);
    const projects = {
      a: { root: 'libs/a' },
      b: { root: 'libs/b' },
      c: { root: 'libs/c' },
    };
    expect(
      getTouchedProjects(fileChanges, buildProjectGraphNodes(projects))
    ).toEqual(['a', 'b']);
  });

  it('should return projects with the root matching a whole directory name in the file path', () => {
    const fileChanges = getFileChanges(['libs/a-b/index.ts']);
    const projects = {
      a: { root: 'libs/a' },
      abc: { root: 'libs/a-b-c' },
      ab: { root: 'libs/a-b' },
    };
    expect(
      getTouchedProjects(fileChanges, buildProjectGraphNodes(projects))
    ).toEqual(['ab']);
  });

  it('should return projects with the root matching a whole directory name in the file path', () => {
    const fileChanges = getFileChanges(['libs/a-b/index.ts']);
    const projects = {
      aaaaa: { root: 'libs/a' },
      abc: { root: 'libs/a-b-c' },
      ab: { root: 'libs/a-b' },
    };
    expect(
      getTouchedProjects(fileChanges, buildProjectGraphNodes(projects))
    ).toEqual(['ab']);
  });

  it('should return the most qualifying match with the file path', () => {
    const fileChanges = getFileChanges(['libs/a/b/index.ts']);
    const projects = {
      aaaaa: { root: 'libs/a' },
      ab: { root: 'libs/a/b' },
    };
    expect(
      getTouchedProjects(fileChanges, buildProjectGraphNodes(projects))
    ).toEqual(['ab']);
  });
});

describe('getImplicitlyTouchedProjects', () => {
  let nxJson;

  beforeEach(() => {
    nxJson = {
      npmScope: 'nrwl',
      implicitDependencies: {
        'styles/file1.css': ['a'],
        'styles/file2.css': ['b', 'c'],
        'styles/deep/file3.css': ['c', 'd'],
      },
      projects: {},
    };
  });

  it('should return a list of projects for the given changes', () => {
    let fileChanges = getFileChanges(['styles/file1.css']);
    expect(getImplicitlyTouchedProjects(fileChanges, null, nxJson)).toEqual([
      'a',
    ]);

    fileChanges = getFileChanges(['styles/file1.css', 'styles/file2.css']);
    expect(getImplicitlyTouchedProjects(fileChanges, null, nxJson)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('should return a list of unique projects', () => {
    const fileChanges = getFileChanges([
      'styles/file2.css',
      'styles/deep/file3.css',
    ]);
    expect(getImplicitlyTouchedProjects(fileChanges, null, nxJson)).toEqual([
      'b',
      'c',
      'd',
    ]);
  });

  it('should support glob path matching', () => {
    nxJson.implicitDependencies = {
      'styles/*.css': ['a'],
      'styles/deep/file2.css': ['b', 'c'],
    };
    let fileChanges = getFileChanges(['styles/file1.css']);
    expect(getImplicitlyTouchedProjects(fileChanges, null, nxJson)).toEqual([
      'a',
    ]);
  });

  it('should support glob `**` path matching', () => {
    nxJson.implicitDependencies = {
      'styles/**/*.css': ['a'],
      'styles/deep/file2.css': ['b', 'c'],
    };
    let fileChanges = getFileChanges(['styles/file1.css']);
    expect(getImplicitlyTouchedProjects(fileChanges, null, nxJson)).toEqual([
      'a',
    ]);

    fileChanges = getFileChanges(['styles/deep/file2.css']);
    expect(getImplicitlyTouchedProjects(fileChanges, null, nxJson)).toEqual([
      'a',
      'b',
      'c',
    ]);

    fileChanges = getFileChanges(['styles/file1.css', 'styles/deep/file2.css']);
    expect(getImplicitlyTouchedProjects(fileChanges, null, nxJson)).toEqual([
      'a',
      'b',
      'c',
    ]);

    fileChanges = getFileChanges(['styles.css']);
    expect(getImplicitlyTouchedProjects(fileChanges, null, nxJson)).toEqual([]);
  });
});

function buildProjectGraphNodes(
  projects: Record<string, ProjectConfiguration>
): ProjectGraph['nodes'] {
  return Object.fromEntries(
    Object.entries(projects).map(
      ([name, config]): [string, ProjectGraphProjectNode] => [
        name,
        {
          data: config,
          name,
          type: config.projectType === 'application' ? 'app' : 'lib',
        },
      ]
    )
  );
}
