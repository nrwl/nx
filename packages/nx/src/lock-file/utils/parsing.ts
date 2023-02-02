import {
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../config/project-graph';
import { ProjectGraphBuilder } from '../../project-graph/project-graph-builder';

type DataParser<T> = (
  data: T,
  builder: ProjectGraphBuilder,
  keyMap: Map<string, ProjectGraphExternalNode>
) => void;

/**
 * Parses lockfile data into a ProjectGraph
 * - addNodes: function that adds nodes to the graph
 * - addDependencies: function that adds dependencies between nodes
 */
export function parseLockfileData<T>(
  data: T,
  addNodes: DataParser<T>,
  addDependencies: DataParser<T>
): ProjectGraph {
  const builder = new ProjectGraphBuilder();

  // we use key => node map to avoid duplicate work when parsing keys
  const keyMap = new Map<string, ProjectGraphExternalNode>();
  addNodes(data, builder, keyMap);
  addDependencies(data, builder, keyMap);

  return builder.getUpdatedProjectGraph();
}

/**
 * This function:
 * - Parses ProjectGraphExternalNode from information (packageName, version, isHoisted)
 * - Adds key to keyMap
 * - Adds node to nodes
 *
 * If node already exists, it will add the key to keyMap and return undefined
 */
export function createNode(
  packageName: string,
  version: string,
  key: string,
  nodes: Map<string, Map<string, ProjectGraphExternalNode>>,
  keyMap: Map<string, ProjectGraphExternalNode>,
  isHoisted?: boolean
): ProjectGraphExternalNode {
  // we don't need to keep duplicates, we can just track the keys
  const existingNode = nodes.get(packageName)?.get(version);
  if (existingNode) {
    keyMap.set(key, existingNode);
    return;
  }

  const node: ProjectGraphExternalNode = {
    type: 'npm',
    name: isHoisted ? `npm:${packageName}` : `npm:${packageName}@${version}`,
    data: {
      version,
      packageName,
    },
  };

  keyMap.set(key, node);
  if (!nodes.has(packageName)) {
    nodes.set(packageName, new Map([[version, node]]));
  } else {
    nodes.get(packageName).set(version, node);
  }

  return node;
}

/**
 * Add nodes to the graph
 * Makes sure that name is correct based on the hoisted version
 */
export function addNodesToBuilder(
  nodes: Map<string, Map<string, ProjectGraphExternalNode>>,
  builder: ProjectGraphBuilder,
  getHoistedVersion: (packageName: string) => string
) {
  for (const [packageName, versionMap] of nodes.entries()) {
    let hoistedNode: ProjectGraphExternalNode;
    if (versionMap.size === 1) {
      hoistedNode = versionMap.values().next().value;
    } else {
      const hoistedVersion = getHoistedVersion(packageName);
      hoistedNode = versionMap.get(hoistedVersion);
    }
    if (hoistedNode) {
      hoistedNode.name = `npm:${packageName}`;
    }

    versionMap.forEach((node) => {
      builder.addExternalNode(node);
    });
  }
}

/**
 * Add graph dependencies of source based on the version range
 * from dependencies section
 */
export function addNodeDependencies(
  source: string,
  section: Record<string, string>,
  builder: ProjectGraphBuilder,
  findTargetCallback: (name, versionSpec) => ProjectGraphExternalNode
) {
  if (section) {
    Object.entries(section).forEach(([name, versionRange]) => {
      const target = findTargetCallback(name, versionRange);
      if (target) {
        builder.addExternalNodeDependency(source, target.name);
      }
    });
  }
}
