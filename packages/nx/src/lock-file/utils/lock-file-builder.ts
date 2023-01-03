import { PackageJson } from '../../utils/package-json';
import { hashString } from './hashing';

export type LockFileGraph = {
  hash: string;
  root: LockFileNode;
  nodes: Map<string, LockFileNode>;
  isValid: boolean;
};

export type LockFileNode = {
  name: string;
  packageName?: string;
  version?: string;
  path: string;
  resolved?: string;
  integrity?: string;
  edgesOut?: Map<string, LockFileEdge>;
  children?: Map<string, LockFileNode>; // used for tracking hoisting
  edgesIn?: Set<LockFileEdge>;
  isProjectRoot?: true;
};

export type LockFileEdge = {
  name: string;
  versionSpec: string;
  from?: LockFileNode;
  to?: LockFileNode;
  // some optional dependencies might be missing
  // we want to keep track of that to avoid false positives
  optional?: boolean;
  // error type if source or target is missing
  error?: 'MISSING_TARGET' | 'MISSING_SOURCE';
};

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
  private hash: string;

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

  private makeRootNode(packageJson: Partial<PackageJson>): LockFileNode {
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
        this.addEdgeOut(node, name, versionSpec, false, skipEdgeInCheck);
      });
    }
    if (devDependencies) {
      Object.entries(devDependencies).forEach(([name, versionSpec]) => {
        this.addEdgeOut(node, name, versionSpec, false, skipEdgeInCheck);
      });
    }
    if (optionalDependencies) {
      Object.entries(optionalDependencies).forEach(([name, versionSpec]) => {
        this.addEdgeOut(node, name, versionSpec, true, skipEdgeInCheck);
      });
    }
    if (peerDependencies) {
      Object.entries(peerDependencies).forEach(([name, versionSpec]) => {
        this.addEdgeOut(
          node,
          name,
          versionSpec,
          packageJson.peerDependenciesMeta?.[name]?.optional,
          skipEdgeInCheck
        );
      });
    }
    return node;
  }

  addEdgeOut(
    node: LockFileNode,
    name: string,
    versionSpec: string,
    isOptional?: boolean,
    skipEdgeInCheck?: boolean
  ) {
    this.validateEdgeCreation(node, name, versionSpec);

    if (!this.isVersionSpecSupported(versionSpec)) {
      return;
    }

    if (!node.edgesOut) {
      node.edgesOut = new Map();
    }
    const existingEdge = this.findEdgeIn(name, versionSpec, node.path);
    if (existingEdge) {
      this.setEdgeSource(existingEdge, node);
    } else {
      const edge: LockFileEdge = {
        name,
        versionSpec,
        from: node,
      };
      if (isOptional) {
        edge.optional = true;
      }
      this.updateEdgeTypeAndError(edge);
      node.edgesOut.set(name, edge);
      if (!skipEdgeInCheck) {
        this.updateEdgeIn(edge);
      }
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

  private findEdgeIn(
    name: string,
    versionSpec: string,
    fromPath: string
  ): LockFileEdge {
    for (const node of this.nodes.values()) {
      if (node.name === name && node.edgesIn) {
        for (const edge of node.edgesIn.values()) {
          if (edge.versionSpec === versionSpec && !edge.from) {
            if (
              edge.to.path === `node_modules/${name}` ||
              edge.to.path.startsWith(`${fromPath}/`)
            ) {
              return edge;
            }
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

  addEdgeIn(node: LockFileNode, versionSpec: string, parent?: LockFileNode) {
    this.validateEdgeCreation(node, node.name, versionSpec);

    const existingEdges = this.findEdgesOut(node.name, versionSpec);
    if (existingEdges.size > 0) {
      existingEdges.forEach((existingEdge) => {
        this.setEdgeTarget(existingEdge, node);
      });
    } else {
      const edge: LockFileEdge = {
        name: node.name,
        versionSpec,
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
    if (!edge.to && !edge.optional) {
      edge.error = 'MISSING_TARGET';
    }
    if (!edge.from) {
      edge.error = 'MISSING_SOURCE';
    } else {
      delete edge.error;
    }
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
      const parentPrefix = `${parentPath}/node_modules`;
      this.nodes.forEach((n) => {
        if (!parentPath || n.path.startsWith(parentPrefix)) {
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

  private verifyNode(node: LockFileNode) {
    let isValid = true;
    if (node.edgesOut && node.edgesOut.size > 0) {
      node.edgesOut.forEach((edge) => {
        if (edge.error) {
          isValid = false;
          console.warn(
            `Outgoing edge "${edge.name}: ${edge.versionSpec}" from ${
              edge.from?.name
            } to ${edge.to?.name || '-'} has error: ${edge.error}`
          );
        }
      });
    }
    if (node.edgesIn && node.edgesIn.size > 0) {
      node.edgesIn.forEach((edge) => {
        if (edge.error) {
          isValid = false;
          console.warn(
            `Incoming edge "${edge.name}: ${edge.versionSpec}" from ${
              edge.from?.name || '-'
            } to ${edge.to?.name} has error: ${edge.error}`
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

  getLockFileGraph(): LockFileGraph {
    let isValid = true;
    if (!this.isGraphConsistent()) {
      console.error(
        `Graph is not consistent. Please report this issue via github`
      );
      isValid = false;
    }

    return {
      root: this.root,
      isValid,
      nodes: this.nodes,
      hash: this.hash,
    };
  }
}
