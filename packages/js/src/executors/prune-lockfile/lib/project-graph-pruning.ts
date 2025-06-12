import type { ProjectGraph } from '@nx/devkit';
import type { PackageJson } from 'nx/src/utils/package-json';
import { ProjectGraphBuilder } from 'nx/src/project-graph/project-graph-builder';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import {
  addNodesAndDependencies,
  findNodeMatchingVersion,
  rehoistNodes,
} from 'nx/src/plugins/js/lock-file/project-graph-pruning';

export function pruneProjectGraph(
  graph: ProjectGraph,
  packageJson: PackageJson
) {
  const builder = new ProjectGraphBuilder();

  const combinedDependencies = normalizeDependencies(packageJson, graph);

  addNodesAndDependencies(graph, combinedDependencies, builder);
  // for NPM (as well as the graph consistency)
  // we need to distinguish between hoisted and non-hoisted dependencies
  rehoistNodes(graph, combinedDependencies, builder);

  return builder.getUpdatedProjectGraph();
}

function normalizeDependencies(packageJson: PackageJson, graph: ProjectGraph) {
  const {
    dependencies,
    devDependencies,
    optionalDependencies,
    peerDependencies,
  } = packageJson;

  const combinedDependencies = {
    ...dependencies,
    ...devDependencies,
    ...optionalDependencies,
    ...peerDependencies,
  };

  Object.entries(combinedDependencies).forEach(
    ([packageName, versionRange]) => {
      if (graph.externalNodes[`npm:${packageName}@${versionRange}`]) {
        return;
      }
      if (
        graph.externalNodes[`npm:${packageName}`] &&
        graph.externalNodes[`npm:${packageName}`].data.version === versionRange
      ) {
        return;
      }
      // otherwise we need to find the correct version
      const node = findNodeMatchingVersion(graph, packageName, versionRange);
      if (node) {
        combinedDependencies[packageName] = node.data.version;
      } else {
        // The node cannot be found in graph.externalNodes, it could be a workspace package
        const isWorkspaceModule = findWorkspaceModule(packageName, graph);
        if (isWorkspaceModule) {
          combinedDependencies[
            packageName
          ] = `file:./workspace_modules/${packageName}`;
          return;
        }
        throw new Error(
          `Pruned lock file creation failed. The following package was not found in the root lock file: ${packageName}@${versionRange}`
        );
      }
    }
  );
  return combinedDependencies;
}

function findWorkspaceModule(packageName: string, projectGraph: ProjectGraph) {
  let maybeProjectNode = projectGraph.nodes[packageName];
  if (maybeProjectNode) {
    return maybeProjectNode;
  }

  for (const [projectName, project] of Object.entries(projectGraph.nodes)) {
    if (project.data.metadata.js.packageName === packageName) {
      return project;
    }
  }
}
