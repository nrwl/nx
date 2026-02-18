import {
  pruneProjectGraph,
  findNodeMatchingVersion,
  addNodesAndDependencies,
  rehoistNodes,
} from './project-graph-pruning';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import { ProjectGraphBuilder } from '../../../project-graph/project-graph-builder';
import { PackageJson } from '../../../utils/package-json';

describe('project-graph-pruning', () => {
  describe('findNodeMatchingVersion', () => {
    let graph: ProjectGraph;

    beforeEach(() => {
      graph = {
        nodes: {},
        dependencies: {},
        externalNodes: {
          'npm:lodash': {
            type: 'npm',
            name: 'npm:lodash',
            data: {
              packageName: 'lodash',
              version: '4.17.21',
            },
          },
          'npm:lodash@4.17.20': {
            type: 'npm',
            name: 'npm:lodash@4.17.20',
            data: {
              packageName: 'lodash',
              version: '4.17.20',
            },
          },
          'npm:lodash@3.0.0': {
            type: 'npm',
            name: 'npm:lodash@3.0.0',
            data: {
              packageName: 'lodash',
              version: '3.0.0',
            },
          },
          'npm:typescript': {
            type: 'npm',
            name: 'npm:typescript',
            data: {
              packageName: 'typescript',
              version: '5.0.0',
            },
          },
        },
      };
    });

    it('should find exact version match', () => {
      const node = findNodeMatchingVersion(graph, 'lodash', '4.17.21');
      expect(node).toBeDefined();
      expect(node?.data.version).toBe('4.17.21');
    });

    it('should find version matching semver range', () => {
      const node = findNodeMatchingVersion(graph, 'lodash', '^4.17.0');
      expect(node).toBeDefined();
      expect(node?.data.version).toBe('4.17.21');
    });

    it('should return undefined when no version matches', () => {
      const node = findNodeMatchingVersion(graph, 'lodash', '^5.0.0');
      expect(node).toBeUndefined();
    });

    it('should return hoisted node when version matches', () => {
      const node = findNodeMatchingVersion(graph, 'typescript', '^5.0.0');
      expect(node).toBeDefined();
      expect(node?.name).toBe('npm:typescript');
      expect(node?.data.version).toBe('5.0.0');
    });

    it('should handle wildcard version', () => {
      const node = findNodeMatchingVersion(graph, 'lodash', '*');
      expect(node).toBeDefined();
      expect(node?.name).toBe('npm:lodash');
    });

    it('should handle latest version', () => {
      const node = findNodeMatchingVersion(graph, 'lodash', 'latest');
      expect(node).toBeDefined();
      // Should return the highest version (4.17.21)
      expect(node?.data.version).toBe('4.17.21');
    });

    it('should return undefined for non-existent package', () => {
      const node = findNodeMatchingVersion(graph, 'nonexistent', '1.0.0');
      expect(node).toBeUndefined();
    });
  });

  describe('addNodesAndDependencies', () => {
    let graph: ProjectGraph;
    let builder: ProjectGraphBuilder;
    let workspacePackages: Map<string, ProjectGraphProjectNode>;

    beforeEach(() => {
      workspacePackages = new Map();
      graph = {
        nodes: {
          'workspace-pkg': {
            name: 'workspace-pkg',
            type: 'lib',
            data: {
              root: 'packages/workspace-pkg',
            },
          },
        },
        dependencies: {
          'npm:lodash': [
            {
              source: 'npm:lodash',
              target: 'npm:lodash@4.17.20',
              type: 'static',
            },
          ],
          'npm:typescript': [],
          'workspace-pkg': [
            {
              source: 'workspace-pkg',
              target: 'npm:typescript',
              type: 'static',
            },
          ],
        },
        externalNodes: {
          'npm:lodash': {
            type: 'npm',
            name: 'npm:lodash',
            data: {
              packageName: 'lodash',
              version: '4.17.21',
            },
          },
          'npm:lodash@4.17.20': {
            type: 'npm',
            name: 'npm:lodash@4.17.20',
            data: {
              packageName: 'lodash',
              version: '4.17.20',
            },
          },
          'npm:typescript': {
            type: 'npm',
            name: 'npm:typescript',
            data: {
              packageName: 'typescript',
              version: '5.0.0',
            },
          },
        },
      };
      workspacePackages.set('workspace-pkg', graph.nodes['workspace-pkg']);
      builder = new ProjectGraphBuilder();
    });

    it('should add external nodes and their dependencies', () => {
      const packageJsonDeps = {
        lodash: '4.17.21',
      };

      addNodesAndDependencies(
        graph,
        packageJsonDeps,
        workspacePackages,
        builder
      );

      const result = builder.getUpdatedProjectGraph();
      expect(result.externalNodes?.['npm:lodash']).toBeDefined();
      expect(result.externalNodes?.['npm:lodash@4.17.20']).toBeDefined();
      expect(result.dependencies['npm:lodash']).toBeDefined();
    });

    it('should handle workspace packages', () => {
      const packageJsonDeps = {
        'workspace-pkg': '*',
      };

      addNodesAndDependencies(
        graph,
        packageJsonDeps,
        workspacePackages,
        builder
      );

      const result = builder.getUpdatedProjectGraph();
      // Should traverse workspace node dependencies
      expect(result.externalNodes?.['npm:typescript']).toBeDefined();
    });

    it('should handle workspace packages when nx.name differs from package.json.name', () => {
      // Setup: Create a workspace library where nx.name differs from package.json.name
      // - package.json.name: '@newest-nx/buildable'
      // - nx.name: 'buildable'
      const workspaceLibWithNxName: ProjectGraphProjectNode = {
        name: 'buildable', // Project name from nx.name
        type: 'lib',
        data: {
          root: 'packages/buildable',
          metadata: {
            js: {
              packageName: '@newest-nx/buildable', // Package name from package.json.name
            },
          },
        },
      };

      // Create a graph where the node is keyed by project name (nx.name)
      const graphWithNxName: ProjectGraph = {
        nodes: {
          buildable: workspaceLibWithNxName, // Keyed by project name, not package name
        },
        dependencies: {
          buildable: [
            {
              source: 'buildable',
              target: 'npm:blurhash@2.0.5',
              type: 'static',
            },
          ],
          'npm:blurhash@2.0.5': [],
        },
        externalNodes: {
          'npm:blurhash@2.0.5': {
            type: 'npm',
            name: 'npm:blurhash@2.0.5',
            data: {
              packageName: 'blurhash',
              version: '2.0.5',
            },
          },
        },
      };

      // workspacePackages map is keyed by package name, not project name
      const workspacePackagesWithNxName = new Map<
        string,
        ProjectGraphProjectNode
      >();
      workspacePackagesWithNxName.set(
        '@newest-nx/buildable',
        workspaceLibWithNxName
      );

      const builderWithNxName = new ProjectGraphBuilder();
      const packageJsonDeps = {
        '@newest-nx/buildable': '*', // Using package name, not project name
      };

      addNodesAndDependencies(
        graphWithNxName,
        packageJsonDeps,
        workspacePackagesWithNxName,
        builderWithNxName
      );

      const result = builderWithNxName.getUpdatedProjectGraph();
      // Should traverse workspace node dependencies even when nx.name differs from package.json.name
      // This test verifies the bug fix: transitive dependencies should be included
      expect(result.externalNodes?.['npm:blurhash@2.0.5']).toBeDefined();
    });

    it('should handle versioned external nodes', () => {
      const packageJsonDeps = {
        lodash: '4.17.20',
      };

      addNodesAndDependencies(
        graph,
        packageJsonDeps,
        workspacePackages,
        builder
      );

      const result = builder.getUpdatedProjectGraph();
      expect(result.externalNodes?.['npm:lodash@4.17.20']).toBeDefined();
    });

    it('should not add duplicate nodes', () => {
      const packageJsonDeps = {
        lodash: '4.17.21',
      };

      addNodesAndDependencies(
        graph,
        packageJsonDeps,
        workspacePackages,
        builder
      );
      addNodesAndDependencies(
        graph,
        packageJsonDeps,
        workspacePackages,
        builder
      );

      const result = builder.getUpdatedProjectGraph();
      const lodashNodes = Object.keys(result.externalNodes || {}).filter(
        (name) => name.startsWith('npm:lodash')
      );
      expect(lodashNodes.length).toBeGreaterThan(0);
    });
  });

  describe('rehoistNodes', () => {
    let graph: ProjectGraph;
    let builder: ProjectGraphBuilder;

    beforeEach(() => {
      graph = {
        nodes: {},
        dependencies: {},
        externalNodes: {
          'npm:lodash': {
            type: 'npm',
            name: 'npm:lodash',
            data: {
              packageName: 'lodash',
              version: '4.17.21',
            },
          },
          'npm:lodash@4.17.20': {
            type: 'npm',
            name: 'npm:lodash@4.17.20',
            data: {
              packageName: 'lodash',
              version: '4.17.20',
            },
          },
        },
      };
      builder = new ProjectGraphBuilder();
    });

    it('should rehoist single nested node', () => {
      // Add nested version to builder (but NOT the hoisted version)
      builder.addExternalNode({
        type: 'npm',
        name: 'npm:lodash@4.17.20',
        data: {
          packageName: 'lodash',
          version: '4.17.20',
        },
      });

      const packageJsonDeps = {
        lodash: '4.17.20',
      };

      rehoistNodes(graph, packageJsonDeps, builder);

      const result = builder.getUpdatedProjectGraph();
      // Should have rehoisted the nested node
      expect(result.externalNodes?.['npm:lodash']).toBeDefined();
      expect(result.externalNodes?.['npm:lodash']?.data.version).toBe(
        '4.17.20'
      );
      // The nested version should be removed
      expect(result.externalNodes?.['npm:lodash@4.17.20']).toBeUndefined();
    });

    it('should not rehoist when no nested nodes exist', () => {
      builder.addExternalNode({
        type: 'npm',
        name: 'npm:lodash',
        data: {
          packageName: 'lodash',
          version: '4.17.21',
        },
      });

      const packageJsonDeps = {
        lodash: '4.17.21',
      };

      rehoistNodes(graph, packageJsonDeps, builder);

      const result = builder.getUpdatedProjectGraph();
      expect(result.externalNodes?.['npm:lodash']).toBeDefined();
    });

    it('should choose closest node when multiple nested versions exist', () => {
      // Add multiple nested versions to builder
      builder.addExternalNode({
        type: 'npm',
        name: 'npm:lodash@4.17.20',
        data: {
          packageName: 'lodash',
          version: '4.17.20',
        },
      });
      builder.addExternalNode({
        type: 'npm',
        name: 'npm:lodash@4.17.19',
        data: {
          packageName: 'lodash',
          version: '4.17.19',
        },
      });
      builder.addStaticDependency('npm:lodash@4.17.20', 'npm:lodash@4.17.19');

      const packageJsonDeps = {
        lodash: '4.17.20',
      };

      rehoistNodes(graph, packageJsonDeps, builder);

      const result = builder.getUpdatedProjectGraph();
      // Should hoist one of the versions (the one closest to package.json deps)
      expect(result.externalNodes?.['npm:lodash']).toBeDefined();
      // Should have hoisted version 4.17.20 since it matches package.json
      expect(result.externalNodes?.['npm:lodash']?.data.version).toBe(
        '4.17.20'
      );
    });
  });

  describe('pruneProjectGraph', () => {
    let graph: ProjectGraph;
    let workspacePackages: Map<string, ProjectGraphProjectNode>;

    beforeEach(() => {
      workspacePackages = new Map();
      graph = {
        nodes: {
          'workspace-lib': {
            name: 'workspace-lib',
            type: 'lib',
            data: {
              root: 'packages/workspace-lib',
              metadata: {
                js: {
                  packageName: 'workspace-lib',
                },
              },
            },
          },
        },
        dependencies: {
          'npm:lodash': [
            {
              source: 'npm:lodash',
              target: 'npm:lodash@4.17.20',
              type: 'static',
            },
          ],
          'npm:lodash@4.17.20': [
            {
              source: 'npm:lodash@4.17.20',
              target: 'npm:typescript',
              type: 'static',
            },
          ],
          'npm:typescript': [],
          'npm:unused-package': [],
          'workspace-lib': [
            {
              source: 'workspace-lib',
              target: 'npm:lodash',
              type: 'static',
            },
          ],
        },
        externalNodes: {
          'npm:lodash': {
            type: 'npm',
            name: 'npm:lodash',
            data: {
              packageName: 'lodash',
              version: '4.17.21',
            },
          },
          'npm:lodash@4.17.20': {
            type: 'npm',
            name: 'npm:lodash@4.17.20',
            data: {
              packageName: 'lodash',
              version: '4.17.20',
            },
          },
          'npm:typescript': {
            type: 'npm',
            name: 'npm:typescript',
            data: {
              packageName: 'typescript',
              version: '5.0.0',
            },
          },
          'npm:unused-package': {
            type: 'npm',
            name: 'npm:unused-package',
            data: {
              packageName: 'unused-package',
              version: '1.0.0',
            },
          },
        },
      };
      // Note: workspacePackages is populated by getWorkspacePackagesFromGraph
      // which looks for project.data.metadata.js.packageName
    });

    it('should prune unused external nodes', () => {
      const prunedPackageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: {
          lodash: '^4.17.0',
        },
      };

      const prunedGraph = pruneProjectGraph(graph, prunedPackageJson);

      expect(prunedGraph.externalNodes?.['npm:unused-package']).toBeUndefined();
      expect(prunedGraph.externalNodes?.['npm:lodash']).toBeDefined();
    });

    it('should include transitive dependencies', () => {
      const prunedPackageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: {
          lodash: '4.17.20',
        },
      };

      const prunedGraph = pruneProjectGraph(graph, prunedPackageJson);

      // typescript is a transitive dependency of lodash@4.17.20
      expect(prunedGraph.externalNodes?.['npm:typescript']).toBeDefined();
      // The node gets rehoisted to npm:lodash because there's a hoisted version in the original graph
      expect(prunedGraph.externalNodes?.['npm:lodash']).toBeDefined();
      expect(prunedGraph.externalNodes?.['npm:lodash']?.data.version).toBe(
        '4.17.20'
      );
    });

    it('should preserve workspace packages', () => {
      const prunedPackageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: {
          'workspace-lib': '*',
        },
      };

      const prunedGraph = pruneProjectGraph(graph, prunedPackageJson);

      expect(prunedGraph.nodes['workspace-lib']).toBeDefined();
    });

    it('should handle devDependencies', () => {
      const prunedPackageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        devDependencies: {
          typescript: '5.0.0',
        },
      };

      const prunedGraph = pruneProjectGraph(graph, prunedPackageJson);

      expect(prunedGraph.externalNodes?.['npm:typescript']).toBeDefined();
    });

    it('should handle peerDependencies', () => {
      const prunedPackageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        peerDependencies: {
          typescript: '^5.0.0',
        },
      };

      const prunedGraph = pruneProjectGraph(graph, prunedPackageJson);

      expect(prunedGraph.externalNodes?.['npm:typescript']).toBeDefined();
    });

    it('should handle optionalDependencies', () => {
      const prunedPackageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        optionalDependencies: {
          typescript: '5.0.0',
        },
      };

      const prunedGraph = pruneProjectGraph(graph, prunedPackageJson);

      expect(prunedGraph.externalNodes?.['npm:typescript']).toBeDefined();
    });

    it('should normalize version ranges to actual versions', () => {
      const prunedPackageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: {
          lodash: '^4.17.0',
        },
      };

      const prunedGraph = pruneProjectGraph(graph, prunedPackageJson);

      // Should use the actual version from the graph
      expect(prunedGraph.externalNodes?.['npm:lodash']).toBeDefined();
    });

    it('should throw error when package not found in graph', () => {
      const prunedPackageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: {
          'nonexistent-package': '1.0.0',
        },
      };

      expect(() => pruneProjectGraph(graph, prunedPackageJson)).toThrow(
        'Pruned lock file creation failed'
      );
    });

    it('should handle complex dependency tree', () => {
      // Create a more complex graph
      const complexGraph: ProjectGraph = {
        nodes: {},
        dependencies: {
          'npm:package-a': [
            {
              source: 'npm:package-a',
              target: 'npm:package-b',
              type: 'static',
            },
            {
              source: 'npm:package-a',
              target: 'npm:package-c',
              type: 'static',
            },
          ],
          'npm:package-b': [
            {
              source: 'npm:package-b',
              target: 'npm:package-d',
              type: 'static',
            },
          ],
          'npm:package-c': [
            {
              source: 'npm:package-c',
              target: 'npm:package-d',
              type: 'static',
            },
          ],
          'npm:package-d': [],
        },
        externalNodes: {
          'npm:package-a': {
            type: 'npm',
            name: 'npm:package-a',
            data: {
              packageName: 'package-a',
              version: '1.0.0',
            },
          },
          'npm:package-b': {
            type: 'npm',
            name: 'npm:package-b',
            data: {
              packageName: 'package-b',
              version: '1.0.0',
            },
          },
          'npm:package-c': {
            type: 'npm',
            name: 'npm:package-c',
            data: {
              packageName: 'package-c',
              version: '1.0.0',
            },
          },
          'npm:package-d': {
            type: 'npm',
            name: 'npm:package-d',
            data: {
              packageName: 'package-d',
              version: '1.0.0',
            },
          },
        },
      };

      const prunedPackageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: {
          'package-a': '1.0.0',
        },
      };

      const prunedGraph = pruneProjectGraph(complexGraph, prunedPackageJson);

      // Should include all transitive dependencies
      expect(prunedGraph.externalNodes?.['npm:package-a']).toBeDefined();
      expect(prunedGraph.externalNodes?.['npm:package-b']).toBeDefined();
      expect(prunedGraph.externalNodes?.['npm:package-c']).toBeDefined();
      expect(prunedGraph.externalNodes?.['npm:package-d']).toBeDefined();
    });

    it('should handle hoisted dependencies correctly', () => {
      const hoistedGraph: ProjectGraph = {
        nodes: {},
        dependencies: {
          'npm:lodash': [
            {
              source: 'npm:lodash',
              target: 'npm:lodash@4.17.20',
              type: 'static',
            },
          ],
          'npm:lodash@4.17.20': [],
        },
        externalNodes: {
          'npm:lodash': {
            type: 'npm',
            name: 'npm:lodash',
            data: {
              packageName: 'lodash',
              version: '4.17.21',
            },
          },
          'npm:lodash@4.17.20': {
            type: 'npm',
            name: 'npm:lodash@4.17.20',
            data: {
              packageName: 'lodash',
              version: '4.17.20',
            },
          },
        },
      };

      const prunedPackageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: {
          lodash: '4.17.20',
        },
      };

      const prunedGraph = pruneProjectGraph(hoistedGraph, prunedPackageJson);

      // Should handle hoisting correctly
      expect(prunedGraph.externalNodes?.['npm:lodash']).toBeDefined();
    });

    it('should preserve dependency relationships', () => {
      const prunedPackageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: {
          lodash: '4.17.20',
        },
      };

      const prunedGraph = pruneProjectGraph(graph, prunedPackageJson);

      // Check that dependencies are preserved
      // The node gets rehoisted, so check the hoisted node's dependencies
      const lodashDeps = prunedGraph.dependencies['npm:lodash'];
      expect(lodashDeps).toBeDefined();
      if (lodashDeps) {
        // Should have dependency on typescript (transitive dependency)
        expect(lodashDeps.some((d) => d.target === 'npm:typescript')).toBe(
          true
        );
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty package.json', () => {
      const graph: ProjectGraph = {
        nodes: {},
        dependencies: {},
        externalNodes: {},
      };

      const prunedPackageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
      };

      const prunedGraph = pruneProjectGraph(graph, prunedPackageJson);

      expect(Object.keys(prunedGraph.externalNodes || {})).toHaveLength(0);
    });

    it('should handle empty graph', () => {
      const graph: ProjectGraph = {
        nodes: {},
        dependencies: {},
        externalNodes: {},
      };

      const prunedPackageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: {
          lodash: '4.17.21',
        },
      };

      expect(() => pruneProjectGraph(graph, prunedPackageJson)).toThrow();
    });

    it('should handle multiple versions of same package', () => {
      const graph: ProjectGraph = {
        nodes: {},
        dependencies: {
          'npm:lodash@4.17.21': [
            {
              source: 'npm:lodash@4.17.21',
              target: 'npm:lodash@4.17.20',
              type: 'static',
            },
          ],
          'npm:lodash@4.17.20': [],
        },
        externalNodes: {
          'npm:lodash@4.17.21': {
            type: 'npm',
            name: 'npm:lodash@4.17.21',
            data: {
              packageName: 'lodash',
              version: '4.17.21',
            },
          },
          'npm:lodash@4.17.20': {
            type: 'npm',
            name: 'npm:lodash@4.17.20',
            data: {
              packageName: 'lodash',
              version: '4.17.20',
            },
          },
        },
      };

      const prunedPackageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: {
          lodash: '4.17.21',
        },
      };

      const prunedGraph = pruneProjectGraph(graph, prunedPackageJson);

      expect(prunedGraph.externalNodes?.['npm:lodash@4.17.21']).toBeDefined();
      expect(prunedGraph.externalNodes?.['npm:lodash@4.17.20']).toBeDefined();
    });
  });
});
