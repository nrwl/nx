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
  const projectNode = findWorkspaceModule(packageJson.name, graph);
  builder.addNode(projectNode);
  const combinedDependencies = normalizeDependencies(
    packageJson,
    graph,
    builder
  );
  const updatedGraph = builder.getUpdatedProjectGraph();
  addNodesAndDependencies(updatedGraph, combinedDependencies, builder);
  // for NPM (as well as the graph consistency)
  // we need to distinguish between hoisted and non-hoisted dependencies
  rehoistNodes(updatedGraph, combinedDependencies, builder);

  return {
    updatedGraph: builder.getUpdatedProjectGraph(),
    combinedDependencies,
  };
}

function normalizeDependencies(
  packageJson: PackageJson,
  graph: ProjectGraph,
  builder: ProjectGraphBuilder
) {
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
        const node = graph.externalNodes[`npm:${packageName}@${versionRange}`];
        builder.addExternalNode(node);
        addDependencyNodeToBuilder(packageName, graph, builder);
        return;
      }
      if (
        graph.externalNodes[`npm:${packageName}`] &&
        graph.externalNodes[`npm:${packageName}`].data.version === versionRange
      ) {
        addDependencyNodeToBuilder(packageName, graph, builder);
        return;
      }
      // otherwise we need to find the correct version
      const node = findNodeMatchingVersion(graph, packageName, versionRange);
      if (node) {
        combinedDependencies[packageName] = node.data.version;
        builder.addExternalNode(node);
        addDependencyNodeToBuilder(packageName, graph, builder);
      } else {
        // The node cannot be found in graph.externalNodes, it could be a workspace package
        const isWorkspaceModule = findWorkspaceModule(packageName, graph);
        if (isWorkspaceModule) {
          combinedDependencies[
            packageName
          ] = `file:./workspace_modules/${packageName}`;
          builder.addExternalNode({
            name: `npm:${packageName}`,
            type: 'nx_js_wm',
            data: {
              packageName: `${packageName}`,
              version: `file:./workspace_modules/${packageName}`,
            },
          });
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

function addDependencyNodeToBuilder(
  packageName: string,
  graph: ProjectGraph,
  builder: ProjectGraphBuilder
) {
  const node = graph.externalNodes[`npm:${packageName}`];
  if (node && !builder.graph.externalNodes[`npm:${packageName}`]) {
    builder.addExternalNode(node);
  }
  if (graph.dependencies[`npm:${packageName}`]) {
    for (const dep of graph.dependencies[`npm:${packageName}`]) {
      builder.graph.dependencies[`npm:${packageName}`] ??= [];
      builder.graph.dependencies[`npm:${packageName}`].push(dep);
      addDependencyNodeToBuilder(
        dep.target.replace('npm:', ''),
        graph,
        builder
      );
    }
  }
}
