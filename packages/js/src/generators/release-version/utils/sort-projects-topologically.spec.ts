import { sortProjectsTopologically } from './sort-projects-topologically';
import { DependencyType, StaticDependency } from '@nx/devkit';

describe('sortProjectsTopologically', () => {
  describe('edge cases', () => {
    it('should return empty array if no projects are provided', () => {
      const projectGraph = {
        dependencies: {},
        nodes: {},
      };
      const projectNodes = [];
      const result = sortProjectsTopologically(projectGraph, projectNodes);
      expect(result).toEqual([]);
    });

    it('should return a single project if only one project is provided', () => {
      const projectGraph = {
        dependencies: {},
        nodes: {
          project1: {
            name: 'project1',
            data: {
              root: '',
            },
            type: 'app' as const,
          },
        },
      };
      const projectNodes = [projectGraph.nodes.project1];
      const result = sortProjectsTopologically(projectGraph, projectNodes);
      expect(result).toEqual([projectGraph.nodes.project1]);
    });

    it('should return the original list of nodes if a circular dependency is present', () => {
      const projectGraph = {
        dependencies: {
          project1: [
            {
              source: 'project1',
              target: 'project2',
              type: 'static',
            },
          ],
          project2: [
            {
              source: 'project2',
              target: 'project1',
              type: 'static',
            },
          ],
        },
        nodes: {
          project1: {
            name: 'project1',
            data: {
              root: '',
            },
            type: 'app' as const,
          },
          project2: {
            name: 'project2',
            data: {
              root: '',
            },
            type: 'app' as const,
          },
        },
      };
      const projectNodes = [
        projectGraph.nodes.project1,
        projectGraph.nodes.project2,
      ];
      const result = sortProjectsTopologically(projectGraph, projectNodes);
      expect(result).toEqual(projectNodes);
    });
  });

  describe('complex sorting cases', () => {
    it('should return [B,A] if A depends on B', () => {
      const projectGraph = {
        dependencies: {
          project1: [
            {
              source: 'project1',
              target: 'project2',
              type: 'static',
            },
          ],
          project2: [],
        },
        nodes: {
          project1: {
            name: 'project1',
            data: {
              root: '',
            },
            type: 'app' as const,
          },
          project2: {
            name: 'project2',
            data: {
              root: '',
            },
            type: 'app' as const,
          },
        },
      };
      const projectNodes = [
        projectGraph.nodes.project1,
        projectGraph.nodes.project2,
      ];
      const result = sortProjectsTopologically(projectGraph, projectNodes);
      expect(result).toEqual([
        projectGraph.nodes.project2,
        projectGraph.nodes.project1,
      ]);
    });
    it('should return [C,B,A] if A depends on B and B depends on C', () => {
      const projectGraph = {
        dependencies: {
          project1: [
            {
              source: 'project1',
              target: 'project2',
              type: 'static',
            },
          ],
          project2: [
            {
              source: 'project2',
              target: 'project3',
              type: 'static',
            },
          ],
        },
        nodes: {
          project1: {
            name: 'project1',
            data: {
              root: '',
            },
            type: 'app' as const,
          },
          project2: {
            name: 'project2',
            data: {
              root: '',
            },
            type: 'app' as const,
          },
          project3: {
            name: 'project3',
            data: {
              root: '',
            },
            type: 'app' as const,
          },
        },
      };
      const projectNodes = [
        projectGraph.nodes.project1,
        projectGraph.nodes.project2,
        projectGraph.nodes.project3,
      ];
      const result = sortProjectsTopologically(projectGraph, projectNodes);
      expect(result).toEqual([
        projectGraph.nodes.project3,
        projectGraph.nodes.project2,
        projectGraph.nodes.project1,
      ]);
    });

    it('should return [A,B,C,D] if A has 0 dependencies, B has 1, C has 2, and D has 3', () => {
      const graphNodes = Object.fromEntries(
        [1, 2, 3, 4].map((n) => {
          return [
            `project${n}`,
            {
              name: `project${n}`,
              data: { root: '' },
              type: 'app' as const,
            },
          ];
        })
      );
      const projectGraph = {
        dependencies: {
          project1: [],
          project2: [
            {
              source: 'project2',
              target: 'project1',
              type: 'static',
            },
          ],
          project3: [
            {
              source: 'project3',
              target: 'project1',
              type: 'static',
            },
            {
              source: 'project3',
              target: 'project2',
              type: 'static',
            },
          ],
          project4: [
            {
              source: 'project4',
              target: 'project3',
              type: 'static',
            },
            {
              source: 'project4',
              target: 'project2',
              type: 'static',
            },
            {
              source: 'project4',
              target: 'project1',
              type: 'static',
            },
          ],
        },
        nodes: graphNodes,
      };
      const projectNodes = [
        projectGraph.nodes.project1,
        projectGraph.nodes.project2,
        projectGraph.nodes.project3,
        projectGraph.nodes.project4,
      ];
      const result = sortProjectsTopologically(projectGraph, projectNodes);
      expect(result).toEqual([
        projectGraph.nodes.project1,
        projectGraph.nodes.project2,
        projectGraph.nodes.project3,
        projectGraph.nodes.project4,
      ]);
    });
  });
});
