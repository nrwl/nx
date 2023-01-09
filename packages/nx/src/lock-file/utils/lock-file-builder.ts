import { output } from '../../utils/output';
import { PackageJson } from '../../utils/package-json';
import { hashString } from './hashing';

export type LockFileGraph = {
  hash: string;
  nodes: Map<string, LockFileNode>;
  isValid: boolean;
};

export type LockFileNode = {
  name: string;
  packageName?: string;
  version?: string;
  integrity?: string;
  edgesOut?: Map<string, LockFileEdge>;
  edgesIn?: Set<LockFileEdge>;
  isHoisted: boolean;
};

export type LockFileEdge = {
  name: string;
  versionSpec: string;
  from?: LockFileNode;
  to?: LockFileNode;
  // some optional dependencies might be missing
  // we want to keep track of that to avoid false positives
  optional?: boolean;
  // incoming edges don't have a source
  incoming?: boolean;
  // error type if source or target is missing
  error?: 'MISSING_TARGET' | 'MISSING_SOURCE';
};

export function nodeKey(node: LockFileNode): string {
  if (node.packageName) {
    return `${node.name}@npm:${node.packageName}@${node.version}`;
  }
  return `${node.name}@${node.version}`;
}

/**
 * A builder for a lock file graph.
 *
 * Constructs graph of nodes and incoming/outgoing edges
 * Inspired by [NPM Arborist](https://www.npmjs.com/package/@npmcli/arborist)
 */
export class LockFileBuilder {
  readonly nodes: Map<string, LockFileNode>;
  private hash: string;

  // we need to keep track of incoming edges when parsing the lock file
  // so we can mark their in edges as incoming
  private incomingEdges = new Map<string, string>();

  constructor(input: LockFileGraph);
  constructor(input: {
    packageJson: Partial<PackageJson>;
    lockFileContent: string;
  });
  constructor(
    input:
      | { packageJson: Partial<PackageJson>; lockFileContent: string }
      | LockFileGraph
  ) {
    if ('nodes' in input) {
      const { hash, nodes } = input;
      this.nodes = nodes;
      this.hash = hash;
    } else {
      const { lockFileContent } = input;
      this.nodes = new Map();
      this.setIncomingEdges(input.packageJson);
      this.hash = lockFileContent ? hashString(lockFileContent) : '';
    }
  }

  private setIncomingEdges(packageJson: Partial<PackageJson>) {
    const {
      dependencies,
      devDependencies,
      optionalDependencies,
      peerDependencies,
    } = packageJson;

    if (dependencies) {
      Object.entries(dependencies).forEach(([name, versionSpec]) => {
        this.incomingEdges.set(name, versionSpec);
      });
    }
    if (devDependencies) {
      Object.entries(devDependencies).forEach(([name, versionSpec]) => {
        this.incomingEdges.set(name, versionSpec);
      });
    }
    if (optionalDependencies) {
      Object.entries(optionalDependencies).forEach(([name, versionSpec]) => {
        this.incomingEdges.set(name, versionSpec);
      });
    }
    if (peerDependencies) {
      Object.entries(peerDependencies).forEach(([name, versionSpec]) => {
        this.incomingEdges.set(name, versionSpec);
      });
    }
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

    // if (name === 'eslint-module-utils' && versionSpec.startsWith('2.7.4')) {
    //   console.log('EDGE OUT', node.name, versionSpec);
    // }

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
            if (!edge.from) {
              return edge;
            } else {
              // one edge in spec can match several edges out
              // so we need to make a duplicate
              matchedNode = edge.from;
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
    // if (node.name === 'eslint-module-utils' && versionSpec.startsWith('2.7.4')) {
    //   console.log('EDGE IN', versionSpec, existingEdges);
    // }
    if (existingEdges.size > 0) {
      existingEdges.forEach((existingEdge) => {
        this.setEdgeTarget(existingEdge, node);
      });
    } else {
      const incoming =
        this.incomingEdges.has(node.name) &&
        this.incomingEdges.get(node.name) === versionSpec;
      const edge: LockFileEdge = {
        name: node.name,
        versionSpec,
        to: node,
        incoming,
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

    // if ((node.name === 'eslint-module-utils' || node.name === 'eslint-module-utils')) {
    //   console.log('NODE', node);
    // }

    // this.nodes.forEach(node => {
    //   if (node.edgesOut && node.edgesOut.has(node.name)) {
    //     const edge = node.edgesOut.get(node.name);
    //     if (edge.versionSpec === node.version && !edge.to) {
    //       this.setEdgeTarget(edge, node);
    //     }
    //   }
    // })
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
          if (process.env.NX_VERBOSE_LOGGING === 'true') {
            errors.push(
              `Outgoing edge "${edge.name}: ${edge.versionSpec}" from "${
                edge.from.name
              }: ${edge.versionSpec}" to ${edge.to?.name || '-'} has error: ${
                edge.error
              }`
            );
          }
        }
      });
    }
    if (node.edgesIn && node.edgesIn.size > 0) {
      node.edgesIn.forEach((edge) => {
        if (edge.error) {
          isValid = false;
          if (process.env.NX_VERBOSE_LOGGING === 'true') {
            errors.push(
              `Incoming edge "${edge.name}: ${edge.versionSpec}" from ${
                edge.from?.name || '-'
              } to ${edge.to?.name} has error: ${edge.error}`
            );
          }
        }
      });
    } else {
      isValid = false;
      if (process.env.NX_VERBOSE_LOGGING === 'true') {
        errors.push(
          `All nodes must have at least one incoming edge. Node "${node.name}@${node.version}" has no incoming edges.`
        );
      }
    }
    return { isValid, errors };
  }

  getLockFileGraph(): LockFileGraph {
    const { isValid, errors } = this.isGraphConsistent();
    if (!isValid) {
      output.error({ title: 'Graph is not consistent', bodyLines: errors });
    }

    return {
      isValid,
      nodes: this.nodes,
      hash: this.hash,
    };
  }
}
