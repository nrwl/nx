import { PackageJson } from '../../utils/package-json';

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
  | 'workspace';
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
  error?: 'MISSING' | 'DETACHED';
};

// TODO 1: Check Arborist for links? Perhaps those should be workspace files
export class LockFileBuilder {
  readonly root: LockFileNode;
  readonly nodes: Map<string, LockFileNode>;
  readonly packageJson: PackageJson;
  // private nodes: Map<string, LockFileNode>
  // private edges: Map<string, LockFileEdge>

  constructor(packageJson: PackageJson) {
    this.packageJson = packageJson;
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
    if (dependencies) {
      Object.entries(dependencies).forEach(([name, versionSpec]) => {
        this.addEdgeOut(node, name, versionSpec, 'prod');
      });
    }
    if (devDependencies) {
      Object.entries(devDependencies).forEach(([name, versionSpec]) => {
        this.addEdgeOut(node, name, versionSpec, 'dev');
      });
    }
    if (optionalDependencies) {
      Object.entries(optionalDependencies).forEach(([name, versionSpec]) => {
        this.addEdgeOut(node, name, versionSpec, 'optional');
      });
    }
    if (peerDependencies) {
      Object.entries(peerDependencies).forEach(([name, versionSpec]) => {
        this.addEdgeOut(node, name, versionSpec, 'peer');
      });
    }
    this.root = node;
    this.nodes = new Map([['', node]]);
  }

  addEdgeOut(
    node: LockFileNode,
    name: string,
    versionSpec: string,
    type: LockFileEdgeType
  ) {
    if (!node) {
      throw new TypeError(`Edge must be bound to a node`);
    }
    if (!node.edgesOut) {
      node.edgesOut = new Map();
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
    if (!type || !VALID_TYPES.has(type)) {
      throw new TypeError(
        `Edge must have a valid type: ${type}\nValid types: ${Array.from(
          VALID_TYPES
        ).join(', ')}`
      );
    }
    if (node.edgesOut.get(name)) {
      this.detachEdge(node.edgesOut.get(name));
    }
    const edge: LockFileEdge = {
      name,
      versionSpec,
      type,
      from: node,
    };
    node.edgesOut.set(name, edge);
    this.updateParentEdgeIn(edge);
  }

  private resolveAncestor(node: LockFileNode, name: string) {
    const nestedChild = node.children?.get(name);
    if (nestedChild) {
      return nestedChild;
    }
    return null;
  }

  private updateParentEdgeIn(edge: LockFileEdge) {
    const to = this.resolveAncestor(edge.from, edge.name);
    if (to !== edge.to) {
      if (edge.to) {
        edge.to.edgesIn.delete(edge);
      }
      edge.to = to;
      edge.error = this.checkEdgeForErrors(edge);
      if (to) {
        edge.to.edgesIn.add(edge);
      }
    }
  }

  private checkEdgeForErrors(edge: LockFileEdge): 'MISSING' | undefined {
    if (!edge.to && edge.type !== 'optional' && edge.type !== 'peerOptional') {
      return 'MISSING';
    } else {
      return;
    }
  }

  private detachEdge(edge: LockFileEdge) {
    if (edge['to']) {
      edge['to'].edgesIn.delete(edge);
    }
    edge.from.edgesOut.delete(edge.name);
    edge.error = 'DETACHED';
    edge.to = null;
    edge.from = null;
  }

  private getParentPath(path: string, name: string) {
    return path.replace(new RegExp(`\/?node_modules\/${name}$`), '');
  }

  private hasUnresolvedEdgeTo(parent: LockFileNode, name: string) {
    return parent.edgesOut?.has(name) && !parent.edgesOut.get(name).to;
  }

  addNode(path: string, node: LockFileNode) {
    this.nodes.set(path, node);

    // find parents and link it
    const parentPath = this.getParentPath(path, node.name);
    const parent = this.nodes.get(parentPath);

    if (!parent.children?.has(node.name)) {
      this.addChild(node, parent);

      // if it's not empty parent path, it means it's nested package -> add edge
      this.nodes.forEach((n) => {
        if (this.hasUnresolvedEdgeTo(n, node.name)) {
          const edge = n.edgesOut.get(node.name);
          this.addEdgeIn(node, n, edge.type);
          edge.to = node;
          edge.error = this.checkEdgeForErrors(edge);
        }
      });
    }

    // find children and link them
    node.edgesOut?.forEach((edge) => {
      if (!edge.to) {
        const child =
          this.nodes.get(`${edge.from.path}/node_modules/${edge.name}`) ||
          this.nodes.get(`node_modules/${edge.name}`);
        if (child) {
          this.addChild(child, node);
          this.addEdgeIn(child, node, edge.type);
        }
      }
    });
  }

  addEdgeIn(node: LockFileNode, parent: LockFileNode, type: LockFileEdgeType) {
    // TODO: ensure there are no duplicates
    node.edgesIn.add({
      name: node.name,
      versionSpec: node.version,
      type,
      from: parent,
      to: node,
    });
  }

  // TODO: children are set incorrectly for 'eslint-plugin-disable-autofix' in V1
  // TODO: and no edge in was added to it back (edgeOut for root exists)
  addChild(node: LockFileNode, parentNode: LockFileNode) {
    if (!parentNode.children) {
      parentNode.children = new Map();
    }
    parentNode.children.set(node.name, node);

    // add node to edge out
    if (parentNode.edgesOut.has(node.name)) {
      const edge = parentNode.edgesOut.get(node.name);
      edge.to = node;
      edge.error = this.checkEdgeForErrors(edge);
    }
  }

  verifyGraphConsistency() {
    return this.verifyNode(this.root);
  }

  private verifyNode(node: LockFileNode, isValid = true) {
    if (node.edgesOut) {
      node.edgesOut.forEach((edge) => {
        if (edge.error) {
          isValid = false;
          console.warn(
            `Edge OUT ${edge.name} from ${edge.from.name} to ${edge.to?.name} has error ${edge.error}`
          );
        }
      });
    }
    if (node.edgesIn) {
      node.edgesIn.forEach((edge) => {
        if (edge.error) {
          isValid = false;
          console.warn(
            `Edge IN ${edge.name} from ${edge.from.name} to ${edge.to?.name} has error ${edge.error}`
          );
        }
      });
    }
    if (node.children) {
      node.children.forEach((child) => {
        isValid ||= this.verifyNode(child, isValid);
      });
    }
    return isValid;
  }

  getLockFileGraph() {
    return this.root;
  }
}
