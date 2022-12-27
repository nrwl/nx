import { PackageJson } from '../../utils/package-json';
import { generatePrunnedHash, hashString } from './hashing';

export type LockFileGraph = {
  hash: string;
  packageJson: PackageJson;
  root: LockFileNode;
  nodes: Map<string, LockFileNode>;
};

export type LockFileNode = {
  name: string;
  packageName?: string;
  version?: string;
  path: string;
  resolved?: string;
  integrity?: string;
  dev?: boolean;
  optional?: boolean;
  peer?: boolean;
  devOptional?: boolean; // tree.devOptional && !tree.dev && !tree.optional
  edgesOut?: Map<string, LockFileEdge>;
  children?: Map<string, LockFileNode>;
  edgesIn?: Set<LockFileEdge>;
  isProjectRoot?: true;
};

type LockFileEdgeType =
  | 'prod'
  | 'dev'
  | 'optional'
  | 'peer'
  | 'peerOptional'
  | 'workspace'
  | 'unknown';

const VALID_TYPES = new Set([
  'prod',
  'dev',
  'optional',
  'peer',
  'peerOptional',
  'workspace',
]);

export type LockFileEdge = {
  name: string;
  versionSpec: string;
  type: LockFileEdgeType;
  from: LockFileNode; // path from
  to?: LockFileNode;
  error?:
    | 'MISSING_TARGET'
    | 'MISSING_SOURCE'
    // | 'DETACHED'
    | 'UNRESOLVED_TYPE';
};

// TODO 1: Check Arborist for links? Perhaps those should be workspace files
/**
 * A builder for a lock file graph.
 *
 * Constructs graph of nodes and incoming/outgoing edges
 *
 * Based and inspired by [NPM Arborist](https://www.npmjs.com/package/@npmcli/arborist)
 */
export class LockFileBuilder {
  readonly root: LockFileNode;
  readonly nodes: Map<string, LockFileNode>;
  readonly packageJson: PackageJson;
  private hash: string;

  constructor(input: LockFileGraph);
  constructor(input: { packageJson: PackageJson; lockFileContent: string });
  constructor(
    input: { packageJson: PackageJson; lockFileContent: string } | LockFileGraph
  ) {
    this.packageJson = input.packageJson;

    if ('root' in input) {
      const { root, hash, nodes } = input;
      this.root = root;
      this.nodes = nodes;
      this.hash = hash;
    } else {
      const { lockFileContent } = input;
      this.nodes = new Map();
      const node = this.makeRootNode(input.packageJson);
      this.root = node;
      this.nodes.set('', node);
      this.hash = lockFileContent ? hashString(lockFileContent) : '';
    }
  }

  private makeRootNode(packageJson: PackageJson): LockFileNode {
    const {
      name,
      version,
      dependencies,
      devDependencies,
      optionalDependencies,
      peerDependencies,
    } = packageJson;

    const node: LockFileNode = {
      name,
      version,
      path: '',
      isProjectRoot: true,
    };
    const skipEdgeInCheck = true;
    if (dependencies) {
      Object.entries(dependencies).forEach(([name, versionSpec]) => {
        this.addEdgeOut(node, name, versionSpec, 'prod', skipEdgeInCheck);
      });
    }
    if (devDependencies) {
      Object.entries(devDependencies).forEach(([name, versionSpec]) => {
        this.addEdgeOut(node, name, versionSpec, 'dev', skipEdgeInCheck);
      });
    }
    if (optionalDependencies) {
      Object.entries(optionalDependencies).forEach(([name, versionSpec]) => {
        this.addEdgeOut(node, name, versionSpec, 'optional', skipEdgeInCheck);
      });
    }
    if (peerDependencies) {
      Object.entries(peerDependencies).forEach(([name, versionSpec]) => {
        this.addEdgeOut(node, name, versionSpec, 'peer', skipEdgeInCheck);
      });
    }
    return node;
  }

  addEdgeOut(
    node: LockFileNode,
    name: string,
    versionSpec: string,
    type: LockFileEdgeType,
    skipEdgeInCheck?: boolean
  ) {
    this.validateEdgeCreation(node, name, versionSpec, type);

    if (!node.edgesOut) {
      node.edgesOut = new Map();
    }
    // if (node.edgesOut.get(name)) {
    //   this.detachEdge(node.edgesOut.get(name));
    // }
    const existingEdge = this.findEdgeIn(name, versionSpec);
    if (existingEdge) {
      this.setEdgeSource(existingEdge, node);
    } else {
      const edge: LockFileEdge = {
        name,
        versionSpec,
        type,
        from: node,
      };
      this.updateEdgeTypeAndError(edge);
      node.edgesOut.set(name, edge);
      if (!skipEdgeInCheck) {
        this.updateEdgeIn(edge);
      }
    }
  }

  private findEdgeIn(name: string, versionSpec: string): LockFileEdge {
    let counter = 0;
    for (const node of this.nodes.values()) {
      if (node.name === name && node.edgesIn) {
        for (const edge of node.edgesIn.values()) {
          if (edge.versionSpec === versionSpec) {
            counter = 10;
            return edge;
          }
        }
      }
    }
    return;
  }

  private findEdgeDescendant(path: string, name: string): LockFileNode {
    let child = this.nodes.get(`${path}node_modules/${name}`);
    if (child) {
      return child;
    }
    if (!path) {
      return;
    }
    const parentPath = path.slice(0, path.lastIndexOf('node_modules'));
    return this.findEdgeDescendant(parentPath, name);
  }

  private updateEdgeIn(edge: LockFileEdge) {
    const to = this.findEdgeDescendant(`${edge.from.path}/`, edge.name);
    if (to !== edge.to) {
      // remove old edge in
      if (edge.to) {
        edge.to.edgesIn.delete(edge);
      }
      edge.to = to;
      this.updateEdgeTypeAndError(edge);
      if (to) {
        if (!to.edgesIn) {
          to.edgesIn = new Set();
        }
        to.edgesIn.add(edge);
      }
    }
  }

  addEdgeIn(
    node: LockFileNode,
    type: LockFileEdgeType,
    versionSpec: string,
    parent?: LockFileNode
  ) {
    this.validateEdgeCreation(node, node.name, versionSpec, type);

    // TODO(meeroslav): Check if this ever happens and remove if not
    // if (Array.from(node.edgesIn).find(edge => edge.from === parent)) {
    //   console.warn(
    //     `Attempting to add duplicate edge in from "${parent.name}" to "${node.name}" with "${type}"`
    //   );
    //   return;
    // }

    const existingEdges = this.findEdgesOut(node.name, versionSpec);
    if (existingEdges.size > 0) {
      existingEdges.forEach((existingEdge) => {
        this.setEdgeTarget(existingEdge, node);
      });
    } else {
      const edge: LockFileEdge = {
        name: node.name,
        versionSpec,
        type,
        from: parent,
        to: node,
      };
      this.assignEdgeIn(edge);
    }
  }

  private findEdgesOut(name: string, versionSpec: string): Set<LockFileEdge> {
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

  private assignEdgeIn(edge: LockFileEdge) {
    this.updateEdgeTypeAndError(edge);
    if (!edge.to) {
      return;
    }
    if (!edge.to.edgesIn) {
      edge.to.edgesIn = new Set();
    }
    edge.to.edgesIn.add(edge);
  }

  private setEdgeSource(edge: LockFileEdge, source: LockFileNode) {
    // detach edge in from old target
    if (edge.from) {
      edge.from.edgesOut.delete(edge.name);
    }
    edge.from = source;
    this.updateEdgeTypeAndError(edge);

    if (!source) {
      return;
    }
    if (!source.edgesOut) {
      source.edgesOut = new Map();
    }
    source.edgesOut.set(edge.name, edge);
  }

  private setEdgeTarget(edge: LockFileEdge, target: LockFileNode) {
    // detach edge in from old target
    if (edge.to) {
      edge.to.edgesIn.delete(edge);
    }
    edge.to = target;
    this.updateEdgeTypeAndError(edge);

    if (!target) {
      return;
    }
    if (!target.edgesIn) {
      target.edgesIn = new Set();
    }
    target.edgesIn.add(edge);
  }

  private updateEdgeTypeAndError(edge: LockFileEdge) {
    if (edge.to && edge.type === 'unknown') {
      edge.type = this.getValidEdgeType(edge.to);
    }
    if (!edge.to && edge.type !== 'optional' && edge.type !== 'peerOptional') {
      edge.error = 'MISSING_TARGET';
    }
    if (!edge.from) {
      edge.error = 'MISSING_SOURCE';
    } else if (edge.to && edge.type === 'unknown') {
      edge.error = 'UNRESOLVED_TYPE';
    } else {
      delete edge.error;
    }
  }

  private getValidEdgeType(node: LockFileNode): LockFileEdgeType {
    if (node.peer && node.optional) {
      return 'peerOptional';
    }
    if (node.optional) {
      return 'optional';
    }
    if (node.peer) {
      return 'peer';
    }
    if (node.dev) {
      return 'dev';
    }
    return 'prod';
  }

  // private detachEdge(edge: LockFileEdge) {
  //   if (edge['to']) {
  //     edge['to'].edgesIn.delete(edge);
  //   }
  //   edge.from.edgesOut.delete(edge.name);
  //   edge.error = 'DETACHED';
  //   edge.to = null;
  //   edge.from = null;
  // }

  private getParentPath(path: string, name: string) {
    return path.replace(new RegExp(`\/?node_modules\/${name}$`), '');
  }

  private hasUnresolvedEdgeTo(parent: LockFileNode, name: string): boolean {
    return parent.edgesOut?.has(name) && !parent.edgesOut.get(name).to;
  }

  private isBetterEdgeMatch(parent: LockFileNode, node: LockFileNode): boolean {
    if (!parent.edgesOut?.has(node.name)) {
      return false;
    }
    const edge = parent.edgesOut.get(node.name);
    return (
      edge.to !== node &&
      edge.to.path.split('node_modules').length <
        node.path.split('node_modules').length
    );
  }

  addNode(path: string, node: LockFileNode) {
    if (path !== node.path) {
      throw new TypeError(
        `Path "${path}" does not match node path "${node.path}"`
      );
    }
    this.nodes.set(path, node);

    // find parents and link it
    const parentPath = this.getParentPath(path, node.name);
    const parent = this.nodes.get(parentPath);

    if (!parent.children?.has(node.name)) {
      this.addChild(node, parent);

      if (parent.edgesOut.has(node.name)) {
        const edge = parent.edgesOut.get(node.name);
        this.setEdgeTarget(edge, node);
      }

      // add any unresolved parent child's edges to this node
      this.nodes.forEach((n) => {
        if (n.path.startsWith(parentPath)) {
          if (
            this.hasUnresolvedEdgeTo(n, node.name) ||
            this.isBetterEdgeMatch(n, node)
          ) {
            const edge = n.edgesOut.get(node.name);
            this.setEdgeTarget(edge, node);
          }
        }
      });
    }
  }

  isGraphConsistent() {
    let isValid = true;
    this.nodes.forEach((node) => {
      if (!this.verifyNode(node)) {
        isValid = false;
      }
    });
    return isValid;
  }

  private addChild(node: LockFileNode, parentNode: LockFileNode) {
    if (!parentNode.children) {
      parentNode.children = new Map();
    }
    parentNode.children.set(node.name, node);
  }

  private validateEdgeCreation(
    node: LockFileNode,
    name: string,
    versionSpec: string,
    type: LockFileEdgeType
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
    if (!type) {
      throw new TypeError(`Edge must have a valid type: ${type}`);
    }
    if (!type || (!VALID_TYPES.has(type) && type !== 'unknown')) {
      throw new TypeError(
        `Edge must have a valid type: ${type}\nValid types: ${Array.from(
          VALID_TYPES
        ).join(', ')}`
      );
    }
  }

  private verifyNode(node: LockFileNode) {
    let isValid = true;
    if (node.edgesOut && node.edgesOut.size > 0) {
      node.edgesOut.forEach((edge) => {
        if (edge.error) {
          isValid = false;
          console.warn(
            `Edge OUT ${edge.name} from ${edge.from?.name} to ${edge.to?.name} has error ${edge.error}`
          );
        }
      });
    }
    if (node.edgesIn && node.edgesIn.size > 0) {
      node.edgesIn.forEach((edge) => {
        if (edge.error) {
          isValid = false;
          console.warn(
            `Edge IN ${edge.name} from ${edge.from?.name} to ${edge.to?.name} has error ${edge.error}`
          );
        }
      });
    } else if (!node.isProjectRoot) {
      isValid = false;
      console.warn(
        `All nodes except the root node must have at least one incoming edge. Node "${node.name}" (${node.path}) has no incoming edges.`
      );
    }
    return isValid;
  }

  private calculateHash(): string {
    return generatePrunnedHash(this.hash, this.packageJson);
  }

  getLockFileGraph(): LockFileGraph {
    if (!this.isGraphConsistent()) {
      console.error(
        `Graph is not consistent. Please report this issue via github`
      );
    }

    return {
      root: this.root,
      packageJson: this.packageJson,
      nodes: this.nodes,
      hash: this.hash || this.calculateHash(),
    };
  }
}
