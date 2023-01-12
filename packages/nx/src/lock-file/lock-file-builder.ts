import { output } from '../utils/output';
import { PackageJson } from '../utils/package-json';
import { LockFileEdge, LockFileGraph, LockFileNode } from './utils/types';

export function nodeKey(node: LockFileNode): string {
  if (node.packageName) {
    return `${node.name}@npm:${node.packageName}@${node.version}`;
  }
  return `${node.name}@${node.version}`;
}

type LockFileBuilderConfig = {
  includeOptional?: boolean;
};

/**
 * A builder for a lock file graph.
 *
 * Constructs graph of nodes and incoming/outgoing edges
 * Inspired by [NPM Arborist](https://www.npmjs.com/package/@npmcli/arborist)
 */
export class LockFileBuilder {
  readonly nodes: Map<string, LockFileNode>;

  // we need to keep track of incoming edges when parsing the lock file
  // so we can mark their in edges as incoming
  private incomingEdges = new Map<string, Set<string>>();
  private config: LockFileBuilderConfig;

  constructor(input: LockFileGraph, config?: LockFileBuilderConfig);
  constructor(
    packageJson: Partial<PackageJson>,
    config?: LockFileBuilderConfig
  );
  constructor(
    input: Partial<PackageJson> | LockFileGraph,
    config?: LockFileBuilderConfig
  ) {
    if ('nodes' in input) {
      const { nodes } = input;
      this.nodes = nodes;
    } else {
      this.nodes = new Map();
      this.incomingEdges = this.parseIncomingEdges(input);
    }
    this.config = config || {};
  }

  private setIncomingSetValue(
    incomingEdges: Map<string, Set<string>>,
    name: string,
    version: string
  ) {
    if (incomingEdges.has(name)) {
      incomingEdges.get(name).add(version);
    } else {
      incomingEdges.set(name, new Set([version]));
    }
  }

  addWorkspaceIncomingEdges(packageJson: Partial<PackageJson>) {
    const {
      dependencies,
      devDependencies,
      optionalDependencies,
      peerDependencies,
    } = packageJson;

    Object.entries({
      ...dependencies,
      ...devDependencies,
      ...optionalDependencies,
      ...peerDependencies,
    }).forEach(([name, versionSpec]) => {
      this.setIncomingSetValue(this.incomingEdges, name, versionSpec);
    });
  }

  isIncomingPackage(name: string, version: string): boolean {
    return (
      this.incomingEdges.has(name) && this.incomingEdges.get(name).has(version)
    );
  }

  private parseIncomingEdges(packageJson: Partial<PackageJson>) {
    // reset incoming edges
    const incomingEdges = new Map<string, Set<string>>();
    const {
      dependencies,
      devDependencies,
      optionalDependencies,
      peerDependencies,
      resolutions,
      overrides,
    } = packageJson;

    Object.entries({
      ...dependencies,
      ...devDependencies,
      ...optionalDependencies,
      ...peerDependencies,
    }).forEach(([name, versionSpec]) => {
      this.setIncomingSetValue(incomingEdges, name, versionSpec);
    });

    if (resolutions) {
      Object.entries(resolutions).forEach(([name, versionSpec]) => {
        const resolutionChunks = name.split('/');
        if (resolutionChunks.length > 1) {
          if (resolutionChunks[resolutionChunks.length - 2].startsWith('@')) {
            name = `${resolutionChunks.slice(-2).join('/')}`;
          } else {
            name = resolutionChunks[resolutionChunks.length - 1];
          }
        }
        this.setIncomingSetValue(incomingEdges, name, versionSpec);
      });
    }
    if (overrides) {
      Object.entries(overrides).forEach(([name, versionSpec]) => {
        // TODO: we do not support nested overrides yet
        if (typeof versionSpec === 'string') {
          this.setIncomingSetValue(incomingEdges, name, versionSpec);
        }
      });
    }
    return incomingEdges;
  }

  addEdgeOut(
    node: LockFileNode,
    name: string,
    versionSpec: string,
    isOptional?: boolean
  ) {
    this.validateEdgeCreation(node, name, versionSpec);

    if (!this.isVersionSpecSupported(versionSpec)) {
      return;
    }

    if (!node.edgesOut) {
      node.edgesOut = new Map();
    }

    const existingEdge = this.findMatchingEdgeIn(name, versionSpec);
    if (existingEdge) {
      this.setEdgeSource(existingEdge, node);
    } else {
      const edge: LockFileEdge = {
        name,
        versionSpec,
        from: node,
        to: this.findMatchingNode(name, versionSpec),
      };
      if (isOptional) {
        edge.optional = true;
      }
      this.updateEdgeError(edge);
      node.edgesOut.set(name, edge);
    }
  }

  // we don't track local files or workspace projects in the graph
  // only exteral dependencies
  private isVersionSpecSupported(versionSpec: string) {
    if (versionSpec.startsWith('file:')) {
      return false;
    }
    if (versionSpec.startsWith('workspace:')) {
      return false;
    }
    return true;
  }

  private findMatchingEdgeIn(name: string, versionSpec: string): LockFileEdge {
    let matchedNode: LockFileNode;
    for (const node of this.nodes.values()) {
      if (node.name === name && node.edgesIn) {
        for (const edge of node.edgesIn.values()) {
          if (edge.versionSpec === versionSpec) {
            if (!edge.from && !edge.incoming) {
              return edge;
            } else {
              // one edge in spec can match several edges out
              // so we need to make a duplicate
              matchedNode = edge.to;
            }
          }
        }
      }
    }
    if (matchedNode) {
      // make a duplicate node, attach to child and return it
      const edge: LockFileEdge = {
        name,
        versionSpec,
        to: matchedNode,
      };
      matchedNode.edgesIn.add(edge);
      return edge;
    }
    return;
  }

  private findMatchingNode(name: string, versionSpec: string): LockFileNode {
    for (const node of this.nodes.values()) {
      if (node.name === name && node.version === versionSpec) {
        return node;
      }
    }
    return;
  }

  addEdgeIn(node: LockFileNode, versionSpec: string) {
    this.validateEdgeCreation(node, node.name, versionSpec);

    const existingEdges = this.findMatchingEdgesOut(node.name, versionSpec);
    if (existingEdges.size > 0) {
      existingEdges.forEach((existingEdge) => {
        this.setEdgeTarget(existingEdge, node);
      });
    } else {
      const edge: LockFileEdge = {
        name: node.name,
        versionSpec,
        to: node,
        incoming: this.isIncomingPackage(node.name, versionSpec),
      };
      this.updateEdgeError(edge);
      edge.to.edgesIn.add(edge);
    }
  }

  private findMatchingEdgesOut(
    name: string,
    versionSpec: string
  ): Set<LockFileEdge> {
    const edges = new Set<LockFileEdge>();
    this.nodes.forEach((node) => {
      if (node.edgesOut?.has(name)) {
        const edge = node.edgesOut.get(name);
        if (edge.versionSpec === versionSpec) {
          edges.add(edge);
        }
      }
    });
    return edges;
  }

  private setEdgeSource(edge: LockFileEdge, source: LockFileNode) {
    // detach edge in from old target
    if (edge.from) {
      edge.from.edgesOut.delete(edge.name);
    }
    edge.from = source;
    this.updateEdgeError(edge);

    source.edgesOut = source.edgesOut || new Map();
    source.edgesOut.set(edge.name, edge);
  }

  private setEdgeTarget(edge: LockFileEdge, target: LockFileNode) {
    // detach edge in from old target
    if (edge.to) {
      edge.to.edgesIn.delete(edge);
    }
    edge.to = target;
    this.updateEdgeError(edge);

    if (!target) {
      return;
    }
    target.edgesIn = target.edgesIn || new Set();
    target.edgesIn.add(edge);
  }

  private updateEdgeError(edge: LockFileEdge) {
    if (!edge.to && !edge.optional) {
      edge.error = 'MISSING_TARGET';
    } else if (!edge.from && !edge.incoming) {
      edge.error = 'MISSING_SOURCE';
    } else {
      delete edge.error;
    }
  }

  addNode(node: LockFileNode) {
    this.nodes.set(nodeKey(node), node);
    node.edgesIn = node.edgesIn || new Set<LockFileEdge>();
  }

  prune(packageJson: Partial<PackageJson>) {
    // TODO: 0. normalize packageJson to ensure correct version (replace version e.g. ^1.0.0 with matching 1.2.3) (happens only with manually modified package.json)

    // prune the nodes
    const prunedNodes = new Set<string>();
    this.parseIncomingEdges(packageJson).forEach((versions, name) => {
      versions.forEach((version) => {
        const key = `${name}@${version}`;
        if (this.nodes.has(key)) {
          const node = this.nodes.get(key);
          if (!prunedNodes.has(key)) {
            this.traverseNode(prunedNodes, node, version);
          } else {
            node.edgesIn.add({
              name,
              to: node,
              versionSpec: version,
              incoming: true,
            });
          }
        } else {
          throw new Error(
            `Pruning failed. Check if all your packages have been installed. Missing node: ${name}@${version}`
          );
        }
      });
    });

    // cleanup nodes and collect packages for rehoisting
    const packagesToRehoist = new Map<string, Set<LockFileNode>>();
    this.nodes.forEach((node, key) => {
      if (!prunedNodes.has(key)) {
        if (node.isHoisted) {
          const nestedVersions = this.collectNestedVersions(
            node.name,
            prunedNodes
          );
          if (nestedVersions.size > 0) {
            packagesToRehoist.set(node.name, nestedVersions);
          }
        }
        this.nodes.delete(key);
      } else {
        node.edgesIn.forEach((edge) => {
          if (edge.from && !prunedNodes.has(nodeKey(edge.from))) {
            node.edgesIn.delete(edge);
          }
        });
      }
    });

    // mark new hoisted packages
    packagesToRehoist.forEach((nestedVersions) => {
      if (nestedVersions.size === 1) {
        const node = nestedVersions.values().next().value;
        node.isHoisted = true;
      } else {
        let minDistance = Infinity;
        let closest;
        nestedVersions.forEach((node) => {
          const distance = this.pathLengthToIncoming(node);
          if (distance < minDistance) {
            minDistance = distance;
            closest = node;
          }
        });
        closest.isHoisted = true;
      }
    });

    const { isValid, errors } = this.isGraphConsistent();
    if (!isValid) {
      const isVerbose = process.env.NX_VERBOSE_LOGGING === 'true';
      output.warn({
        title:
          'Graph is not consistent after pruning. Use --verbose to see details.',
        bodyLines: isVerbose ? errors : [],
      });
    }
  }

  // use BFS to calculate the shortest path to an incoming edge
  private pathLengthToIncoming(node: LockFileNode): number {
    const visited = new Set<LockFileNode>([node]);
    const queue: Array<[LockFileNode, number]> = [[node, 0]];

    while (queue.length > 0) {
      const [current, distance] = queue.shift();

      for (let edge of current.edgesIn) {
        if (edge.incoming) {
          return distance;
        }
        if (!visited.has(edge.from)) {
          visited.add(edge.from);
          queue.push([edge.from, distance + 1]);
        }
      }
    }
  }

  private collectNestedVersions(
    name: string,
    prunedNodes: Set<string>
  ): Set<LockFileNode> {
    const nestedVersions = new Set<LockFileNode>();
    for (const [key, node] of this.nodes.entries()) {
      if (node.name === name && !node.isHoisted && prunedNodes.has(key)) {
        nestedVersions.add(node);
      }
    }
    return nestedVersions;
  }

  private traverseNode(
    prunedNodes: Set<string>,
    node: LockFileNode,
    incomingVersion?: string
  ): void {
    if (!prunedNodes.has(nodeKey(node))) {
      prunedNodes.add(nodeKey(node));

      // remove incoming edges
      node.edgesIn.forEach((edge) => {
        if (edge.incoming) {
          node.edgesIn.delete(edge);
        }
      });

      if (incomingVersion) {
        const edge: LockFileEdge = {
          name: node.name,
          to: node,
          versionSpec: incomingVersion,
          incoming: true,
        };
        node.edgesIn.add(edge);
      }

      node.edgesOut?.forEach((edge) => {
        if (edge.to && (!edge.optional || this.config.includeOptional)) {
          this.traverseNode(prunedNodes, edge.to);
        }
      });
    }
  }

  isGraphConsistent(): { isValid: boolean; errors: string[] } {
    let isValid = true;
    const errors = [];
    this.nodes.forEach((node) => {
      const result = this.verifyNode(node);
      isValid = isValid && result.isValid;
      errors.push(...result.errors);
    });
    return { isValid, errors };
  }

  private validateEdgeCreation(
    node: LockFileNode,
    name: string,
    versionSpec: string
  ) {
    if (!node) {
      throw new TypeError(`Edge must be bound to a node`);
    }
    if (!name) {
      throw new TypeError(`Edge must have a valid name: ${name}`);
    }
    if (!versionSpec) {
      throw new TypeError(
        `Edge must have a valid version specification: ${versionSpec}`
      );
    }
  }

  private verifyNode(node: LockFileNode): {
    isValid: boolean;
    errors: string[];
  } {
    let isValid = true;
    const errors = [];
    if (node.edgesOut && node.edgesOut.size > 0) {
      node.edgesOut.forEach((edge) => {
        if (edge.error) {
          isValid = false;
          errors.push(
            `Outgoing edge "${edge.name}: ${edge.versionSpec}" from "${
              edge.from.name
            }: ${edge.versionSpec}" to ${edge.to?.name || '-'} has error: ${
              edge.error
            }`
          );
        } else if (edge.to && edge.name !== edge.to.name) {
          isValid = false;
          errors.push(
            `Outgoing edge "${edge.name}" does not match target node name "${edge.to.name}"` +
              `... ${edge.from.name} => ${edge.to.name} = ${edge.name}/${edge.versionSpec}`
          );
        }
      });
    }
    if (node.edgesIn && node.edgesIn.size > 0) {
      node.edgesIn.forEach((edge) => {
        if (edge.error) {
          isValid = false;
          errors.push(
            `Incoming edge "${edge.name}: ${edge.versionSpec}" from ${
              edge.from?.name || '-'
            } to ${edge.to?.name} has error: ${edge.error}`
          );
        }
      });
    } else {
      isValid = false;
      errors.push(
        `All nodes must have at least one incoming edge. Node "${node.name}@${node.version}" has no incoming edges.`
      );
    }
    return { isValid, errors };
  }

  getLockFileGraph(): LockFileGraph {
    const { isValid, errors } = this.isGraphConsistent();
    if (!isValid) {
      const isVerbose = process.env.NX_VERBOSE_LOGGING === 'true';
      output.warn({
        title:
          'Graph is not consistent. Make sure your node_modules are in sync with lock file',
        bodyLines: isVerbose ? errors : [],
      });
    }

    return {
      isValid,
      nodes: this.nodes,
    };
  }
}
