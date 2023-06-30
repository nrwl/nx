import {
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import { runProjectsTopologically } from './run-projects-topologically';

function projectNode(
  projectNode: Partial<ProjectGraphProjectNode>
): ProjectGraphProjectNode {
  return projectNode as ProjectGraphProjectNode;
}

function projectGraphDependency(
  dep: Partial<ProjectGraphDependency>
): ProjectGraphDependency {
  return dep as ProjectGraphDependency;
}

function createProjectGraph<T extends ProjectGraphProjectNode>({
  projects,
  dependencies,
}: {
  projects: T[];
  dependencies: ProjectGraphDependency[];
}): ProjectGraph {
  return {
    nodes: projects.reduce(
      (acc, project) => ({ ...acc, [project.name]: project }),
      {}
    ),
    dependencies: dependencies.reduce(
      (prev, next) => ({
        ...prev,
        [next.source]: [...(prev[next.source] || []), next],
      }),
      {} as Record<string, ProjectGraphDependency[]>
    ),
  };
}

describe('runProjectsTopologically', () => {
  it('should run projects in order by depth of tree with leaves first', async () => {
    const projects: ProjectGraphProjectNode[] = [
      projectNode({
        name: 'ppp2',
        type: 'lib',
        data: {
          root: 'packages-other/eee2',
        },
      }),
      projectNode({
        name: 'ooo1',
        type: 'lib',
        data: {
          root: 'packages-other/ooo1',
        },
      }),
      projectNode({
        name: 'ooo2',
        type: 'lib',
        data: {
          root: 'packages-other/ooo2',
        },
      }),
      projectNode({
        name: 'other-1',
        type: 'lib',
        data: {
          root: 'packages/other-1',
        },
      }),
      projectNode({
        name: 'other-2',
        type: 'lib',
        data: {
          root: 'packages/other-2',
        },
      }),
      projectNode({
        name: 'other-with-scope',
        type: 'lib',
        data: {
          root: 'packages/other-with-scope',
        },
      }),
      projectNode({
        name: 'package-1',
        type: 'lib',
        data: {
          root: 'packages/package-1',
        },
      }),
      projectNode({
        name: 'package-2',
        type: 'lib',
        data: {
          root: 'packages/package-2',
        },
      }),
      projectNode({
        name: 'package-base',
        type: 'lib',
        data: {
          root: 'packages/package-base',
        },
      }),
    ];
    const dependencies: ProjectGraphDependency[] = [
      projectGraphDependency({
        source: 'other-1',
        target: 'other-2',
      }),
      projectGraphDependency({
        source: 'package-1',
        target: 'package-2',
      }),
      projectGraphDependency({
        source: 'package-1',
        target: 'package-base',
      }),
      projectGraphDependency({
        source: 'package-2',
        target: 'package-base',
      }),
      projectGraphDependency({
        source: 'ooo1',
        target: 'ooo2',
      }),
      projectGraphDependency({
        source: 'ooo1',
        target: 'ppp2',
      }),
    ];

    const projectGraph = createProjectGraph({ projects, dependencies });

    const result: string[] = [];
    const runner = (node: ProjectGraphProjectNode) => {
      result.push(node.name);
      return Promise.resolve();
    };

    await runProjectsTopologically(projects, projectGraph, runner, {
      concurrency: 4,
    });

    expect(result).toEqual([
      'ppp2',
      'ooo2',
      'other-2',
      'other-with-scope',
      'package-base',
      'ooo1',
      'other-1',
      'package-2',
      'package-1',
    ]);
  });

  it('should order projects by depth of the tree with leaves first, ignoring dependencies of projects that are not provided', async () => {
    const projects: ProjectGraphProjectNode[] = [
      projectNode({
        name: 'package-1',
        type: 'lib',
        data: {
          root: 'packages/package-1',
        },
      }),
      projectNode({
        name: 'package-2',
        type: 'lib',
        data: {
          root: 'packages/package-2',
        },
      }),
      projectNode({
        name: 'package-3',
        type: 'lib',
        data: {
          root: 'packages/package-3',
        },
      }),
      projectNode({
        name: 'package-4',
        type: 'lib',
        data: {
          root: 'packages/package-4',
        },
      }),
      projectNode({
        name: 'package-5',
        type: 'lib',
        data: {
          root: 'packages/package-5',
        },
      }),
      projectNode({
        name: 'package-6',
        type: 'lib',
        data: {
          root: 'packages/package-6',
        },
      }),
    ];
    const dependencies: ProjectGraphDependency[] = [
      projectGraphDependency({
        source: 'package-1',
        target: 'package-2',
      }),
      projectGraphDependency({
        source: 'package-2',
        target: 'package-3',
      }),
      projectGraphDependency({
        source: 'package-3',
        target: 'package-4',
      }),
      projectGraphDependency({
        source: 'package-4',
        target: 'package-5',
      }),
      projectGraphDependency({
        source: 'package-5',
        target: 'package-6',
      }),
    ];

    const projectGraph = createProjectGraph({ projects, dependencies });

    const projectsToRun = [
      projectGraph.nodes['package-2'],
      projectGraph.nodes['package-3'],
      projectGraph.nodes['package-4'],
    ];

    const result: string[] = [];
    const runner = (node: ProjectGraphProjectNode) => {
      result.push(node.name);
      return Promise.resolve();
    };

    await runProjectsTopologically(projectsToRun, projectGraph, runner, {
      concurrency: 4,
    });

    expect(result).toEqual(['package-4', 'package-3', 'package-2']);
  });

  it('should order projects by depth of the tree with leaves first, ignoring and skipping dependencies of projects that are not provided', async () => {
    const projects: ProjectGraphProjectNode[] = [
      projectNode({
        name: 'package-1',
        type: 'lib',
        data: {
          root: 'packages/package-1',
        },
      }),
      projectNode({
        name: 'package-2',
        type: 'lib',
        data: {
          root: 'packages/package-2',
        },
      }),
      projectNode({
        name: 'package-3',
        type: 'lib',
        data: {
          root: 'packages/package-3',
        },
      }),
      projectNode({
        name: 'package-4',
        type: 'lib',
        data: {
          root: 'packages/package-4',
        },
      }),
      projectNode({
        name: 'package-5',
        type: 'lib',
        data: {
          root: 'packages/package-5',
        },
      }),
      projectNode({
        name: 'package-6',
        type: 'lib',
        data: {
          root: 'packages/package-6',
        },
      }),
    ];
    const dependencies: ProjectGraphDependency[] = [
      projectGraphDependency({
        source: 'package-1',
        target: 'package-2',
      }),
      projectGraphDependency({
        source: 'package-2',
        target: 'package-3',
      }),
      projectGraphDependency({
        source: 'package-3',
        target: 'package-4',
      }),
      projectGraphDependency({
        source: 'package-4',
        target: 'package-5',
      }),
      projectGraphDependency({
        source: 'package-5',
        target: 'package-6',
      }),
    ];

    const projectGraph = createProjectGraph({ projects, dependencies });

    const projectsToRun = [
      projectGraph.nodes['package-2'],
      projectGraph.nodes['package-4'],
    ];

    const result: string[] = [];
    const runner = (node: ProjectGraphProjectNode) => {
      result.push(node.name);
      return Promise.resolve();
    };

    await runProjectsTopologically(projectsToRun, projectGraph, runner, {
      concurrency: 4,
    });

    // does not recognize the dependency chain of package-2 -> package-3 -> package-4
    // because package-3 is not in the set of projects to run.
    expect(result).toEqual(['package-2', 'package-4']);
  });

  it('should handle cycles', async () => {
    const projects: ProjectGraphProjectNode[] = [
      projectNode({
        name: 'ppp2',
        type: 'lib',
        data: {
          root: 'packages-other/eee2',
        },
      }),
      projectNode({
        name: 'ooo1',
        type: 'lib',
        data: {
          root: 'packages-other/ooo1',
        },
      }),
      projectNode({
        name: 'ooo2',
        type: 'lib',
        data: {
          root: 'packages-other/ooo2',
        },
      }),
      projectNode({
        name: 'cycle-1',
        type: 'lib',
        data: {
          root: 'packages/cycle-1',
        },
      }),
      projectNode({
        name: 'cycle-2',
        type: 'lib',
        data: {
          root: 'packages/cycle-2',
        },
      }),
      projectNode({
        name: 'cycle-3',
        type: 'lib',
        data: {
          root: 'packages/cycle-3',
        },
      }),
      projectNode({
        name: 'other-1',
        type: 'lib',
        data: {
          root: 'packages/other-1',
        },
      }),
      projectNode({
        name: 'other-2',
        type: 'lib',
        data: {
          root: 'packages/other-2',
        },
      }),
      projectNode({
        name: 'other-with-scope',
        type: 'lib',
        data: {
          root: 'packages/other-with-scope',
        },
      }),
      projectNode({
        name: 'package-1',
        type: 'lib',
        data: {
          root: 'packages/package-1',
        },
      }),
      projectNode({
        name: 'package-2',
        type: 'lib',
        data: {
          root: 'packages/package-2',
        },
      }),
      projectNode({
        name: 'package-base',
        type: 'lib',
        data: {
          root: 'packages/package-base',
        },
      }),
    ];
    const dependencies: ProjectGraphDependency[] = [
      projectGraphDependency({
        source: 'cycle-1',
        target: 'cycle-2',
      }),
      projectGraphDependency({
        source: 'cycle-1',
        target: 'ooo1',
      }),
      projectGraphDependency({
        source: 'cycle-2',
        target: 'cycle-3',
      }),
      projectGraphDependency({
        source: 'cycle-2',
        target: 'ooo1',
      }),
      projectGraphDependency({
        source: 'cycle-3',
        target: 'cycle-1',
      }),
      projectGraphDependency({
        source: 'other-1',
        target: 'other-2',
      }),
      projectGraphDependency({
        source: 'package-1',
        target: 'package-2',
      }),
      projectGraphDependency({
        source: 'package-1',
        target: 'package-base',
      }),
      projectGraphDependency({
        source: 'package-2',
        target: 'package-base',
      }),
      projectGraphDependency({
        source: 'package-2',
        target: 'cycle-1',
      }),
      projectGraphDependency({
        source: 'ooo1',
        target: 'ooo2',
      }),
      projectGraphDependency({
        source: 'ooo1',
        target: 'ppp2',
      }),
    ];

    const projectGraph = createProjectGraph({ projects, dependencies });

    const result: string[] = [];
    const runner = (node: ProjectGraphProjectNode) => {
      result.push(node.name);
      return Promise.resolve();
    };

    await runProjectsTopologically(projects, projectGraph, runner, {
      concurrency: 4,
    });

    expect(result).toEqual([
      'ppp2',
      'ooo2',
      'other-2',
      'other-with-scope',
      'package-base',
      'ooo1',
      'other-1',
      'cycle-1',
      'cycle-2',
      'cycle-3',
      'package-2',
      'package-1',
    ]);
  });

  it('should handle nested cycles', async () => {
    const projects: ProjectGraphProjectNode[] = [
      projectNode({
        name: 'package-1',
        type: 'lib',
        data: {
          root: 'packages/package-1',
        },
      }),
      projectNode({
        name: 'package-2',
        type: 'lib',
        data: {
          root: 'packages/package-2',
        },
      }),
      projectNode({
        name: 'package-3',
        type: 'lib',
        data: {
          root: 'packages/package-3',
        },
      }),
      projectNode({
        name: 'package-4',
        type: 'lib',
        data: {
          root: 'packages/package-4',
        },
      }),
      projectNode({
        name: 'package-5',
        type: 'lib',
        data: {
          root: 'packages/package-5',
        },
      }),
      projectNode({
        name: 'package-6',
        type: 'lib',
        data: {
          root: 'packages/package-6',
        },
      }),
      projectNode({
        name: 'package-7',
        type: 'lib',
        data: {
          root: 'packages/package-7',
        },
      }),
      projectNode({
        name: 'package-8',
        type: 'lib',
        data: {
          root: 'packages/package-8',
        },
      }),
      projectNode({
        name: 'package-9',
        type: 'lib',
        data: {
          root: 'packages/package-9',
        },
      }),
    ];
    const dependencies: ProjectGraphDependency[] = [
      projectGraphDependency({
        source: 'package-1',
        target: 'package-2',
      }),
      projectGraphDependency({
        source: 'package-1',
        target: 'package-7',
      }),
      projectGraphDependency({
        source: 'package-2',
        target: 'package-3',
      }),
      projectGraphDependency({
        source: 'package-3',
        target: 'package-4',
      }),
      projectGraphDependency({
        source: 'package-3',
        target: 'package-5',
      }),
      projectGraphDependency({
        source: 'package-4',
        target: 'package-2',
      }),
      projectGraphDependency({
        source: 'package-5',
        target: 'package-6',
      }),
      projectGraphDependency({
        source: 'package-6',
        target: 'package-3',
      }),
      projectGraphDependency({
        source: 'package-7',
        target: 'package-5',
      }),
      projectGraphDependency({
        source: 'package-8',
        target: 'package-9',
      }),
    ];

    const projectGraph = createProjectGraph({ projects, dependencies });

    const result: string[] = [];
    const runner = (node: ProjectGraphProjectNode) => {
      result.push(node.name);
      return Promise.resolve();
    };

    await runProjectsTopologically(projects, projectGraph, runner, {
      concurrency: 4,
    });

    expect(result).toEqual([
      'package-9',
      'package-8',
      'package-2',
      'package-3',
      'package-4',
      'package-5',
      'package-6',
      'package-7',
      'package-1',
    ]);
  });

  it('should handle cycles with dependencies', async () => {
    const projects: ProjectGraphProjectNode[] = [
      projectNode({
        name: 'a',
      }),
      projectNode({
        name: 'b',
      }),
      projectNode({
        name: 'c',
      }),
      projectNode({
        name: 'd',
      }),
      projectNode({
        name: 'e',
      }),
      projectNode({
        name: 'f',
      }),
      projectNode({
        name: 'g',
      }),
      projectNode({
        name: 'h',
      }),
    ];
    const dependencies: ProjectGraphDependency[] = [
      projectGraphDependency({
        source: 'a',
        target: 'b',
      }),
      projectGraphDependency({
        source: 'a',
        target: 'h',
      }),
      projectGraphDependency({
        source: 'b',
        target: 'c',
      }),
      projectGraphDependency({
        source: 'c',
        target: 'd',
      }),
      projectGraphDependency({
        source: 'd',
        target: 'b',
      }),
      projectGraphDependency({
        source: 'h',
        target: 'e',
      }),
      projectGraphDependency({
        source: 'd',
        target: 'g',
      }),
      projectGraphDependency({
        source: 'g',
        target: 'e',
      }),
      projectGraphDependency({
        source: 'e',
        target: 'f',
      }),
      projectGraphDependency({
        source: 'f',
        target: 'g',
      }),
    ];

    const projectGraph = createProjectGraph({ projects, dependencies });

    const result: string[] = [];
    const runner = (node: ProjectGraphProjectNode) => {
      result.push(node.name);
      return Promise.resolve();
    };

    await runProjectsTopologically(projects, projectGraph, runner, {
      concurrency: 4,
    });

    expect(result).toEqual(['g', 'e', 'f', 'b', 'c', 'd', 'h', 'a']);
  });
});
