import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import { WholeFileChange } from '../../file-utils';
import {
  getTouchedProjects,
  getImplicitlyTouchedProjects,
  extractGlobalFilesFromInputs,
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

  it('should not return parent project if nested project is touched', () => {
    const fileChanges = getFileChanges(['libs/a/b/index.ts']);
    const projects = {
      a: { root: 'libs/a' },
      b: { root: 'libs/a/b' },
    };
    expect(
      getTouchedProjects(fileChanges, buildProjectGraphNodes(projects))
    ).toEqual(['b']);
  });

  it('should return projects with the package.json changed', () => {
    const fileChanges = getFileChanges([
      'libs/a/package.json',
      'libs/c/package.json',
    ]);
    const projects = {
      a: { root: 'libs/a' },
      b: { root: 'libs/b' },
      c: { root: 'libs/c' },
    };
    expect(
      getTouchedProjects(fileChanges, buildProjectGraphNodes(projects))
    ).toEqual(['a', 'c']);
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

  it('should return projects which have touched files in their named inputs', () => {
    const graph = buildProjectGraphNodes({
      a: {
        root: 'a',
        namedInputs: {
          projectSpecificFiles: ['{workspaceRoot}/a.txt'],
        },
      },
      b: {
        root: 'b',
      },
    });
    let fileChanges = getFileChanges(['a.txt']);
    expect(getImplicitlyTouchedProjects(fileChanges, graph, nxJson)).toEqual([
      'a',
    ]);
  });

  it('should return projects which have touched files in their target inputs', () => {
    const graph = buildProjectGraphNodes({
      a: {
        root: 'a',
        targets: {
          build: {
            inputs: ['{workspaceRoot}/a.txt'],
          },
        },
      },
      b: {
        root: 'b',
      },
    });
    let fileChanges = getFileChanges(['a.txt']);
    expect(getImplicitlyTouchedProjects(fileChanges, graph, nxJson)).toEqual([
      'a',
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

  describe('lockfile change handling', () => {
    const graph = buildProjectGraphNodes({
      a: {
        root: 'a',
      },
      b: {
        root: 'b',
      },
      c: {
        root: 'c',
      },
    });

    beforeEach(() => {
      nxJson.implicitDependencies = {};
    });

    it('should not return all packages when the lockfile changed without changes to the root package.json', () => {
      let fileChanges = getFileChanges(['a/package.json', 'package-lock.json']);
      expect(getImplicitlyTouchedProjects(fileChanges, graph, nxJson)).toEqual(
        []
      );

      fileChanges = getFileChanges(['b/package.json', 'yarn.lock']);
      expect(getImplicitlyTouchedProjects(fileChanges, graph, nxJson)).toEqual(
        []
      );

      fileChanges = getFileChanges(['c/package.json', 'pnpm-lock.yaml']);
      expect(getImplicitlyTouchedProjects(fileChanges, graph, nxJson)).toEqual(
        []
      );
    });

    it('should return all packages when the lockfile and the root package.json were changed', () => {
      const allPackages = ['a', 'b', 'c'];

      let fileChanges = getFileChanges(['package.json', 'package-lock.json']);
      expect(getImplicitlyTouchedProjects(fileChanges, graph, nxJson)).toEqual(
        allPackages
      );

      fileChanges = getFileChanges(['package.json', 'yarn.lock']);
      expect(getImplicitlyTouchedProjects(fileChanges, graph, nxJson)).toEqual(
        allPackages
      );

      fileChanges = getFileChanges(['package.json', 'pnpm-lock.yaml']);
      expect(getImplicitlyTouchedProjects(fileChanges, graph, nxJson)).toEqual(
        allPackages
      );
    });
  });
});

describe('extractGlobalFilesFromInputs', () => {
  it('should return list of global files from nx.json', () => {
    const globalFiles = extractGlobalFilesFromInputs({
      namedInputs: {
        one: [
          '{workspaceRoot}/global1.txt',
          { fileset: '{workspaceRoot}/global2.txt' },
          '{projectRoot}/local.txt',
        ],
      },
      targetDefaults: {
        build: {
          inputs: ['{workspaceRoot}/global3.txt'],
        },
      },
    });
    expect(globalFiles).toEqual(['global1.txt', 'global2.txt', 'global3.txt']);
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
          data: config as any,
          name,
          type: config.projectType === 'application' ? 'app' : 'lib',
        },
      ]
    )
  );
}
