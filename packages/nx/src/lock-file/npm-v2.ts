import { PackageJson } from '../utils/package-json';
import {
  LockFileBuilder,
  LockFileGraph,
  LockFileNode,
} from './utils/lock-file-builder';

type NpmDependencyV3 = {
  version: string;
  resolved: string;
  integrity: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional: boolean }>;
  dev?: boolean;
  peer?: boolean;
  devOptional?: boolean;
  optional?: boolean;
  name?: string;
};

type NpmDependencyV1 = {
  version: string;
  resolved: string;
  integrity: string;
  requires?: Record<string, string>;
  dependencies?: Record<string, NpmDependencyV1>;
  dev?: boolean;
  peer?: boolean;
  devOptional?: boolean;
  optional?: boolean;
  name?: string;
};

/**
 * Lock file version differences:
 * - v1 has only dependencies
 * - v2 has dependencies and packages for backwards compatibility
 * - v3 has only packages
 */
type NpmLockFile = {
  name?: string;
  version?: string;
  lockfileVersion: number;
  requires?: boolean;
  packages?: Record<string, NpmDependencyV3>;
  dependencies?: Record<string, NpmDependencyV1>;
};

export function parseNpmLockFile(
  lockFileContent: string,
  packageJson: PackageJson
): LockFileGraph {
  const { name, version, lockfileVersion, ...packageInfo } = JSON.parse(
    lockFileContent
  ) as NpmLockFile;

  const builder = new LockFileBuilder({ packageJson, lockFileContent });

  lockfileVersion === 1
    ? parseV1LockFile(builder, packageInfo)
    : parseV3LockFile(builder, packageInfo); // we will treat V2 lockfile as V3 but map it back to V2 for backwards compatibility

  return builder.getLockFileGraph();
}

// adds edge out to node
function addEdge(builder, node, depName, depSpec, type) {
  if (!node.edgesOut || !node.edgesOut.has(depName)) {
    builder.addEdgeOut(node, depName, depSpec, type);
  }
}

function parseV1LockFile(
  builder: LockFileBuilder,
  content: Omit<NpmLockFile, 'lockfileVersion'>
) {
  const { dependencies } = content;

  if (dependencies) {
    Object.entries(dependencies).forEach(([packageName, value]) => {
      processV1Node(builder, packageName, value, `node_modules/${packageName}`);
    });
  }
}

// parse node value from lock file into `LockFileNode`
function processV1Node(
  builder: LockFileBuilder,
  name: string,
  value: NpmDependencyV1,
  path: string
): void {
  let { version, resolved, peer, optional, dev, integrity } = value;
  let packageName;
  const devOptional = dev || optional || value.devOptional;

  // alias packages have versions in the form of `npm:packageName@version`
  // the name from the node_modules would not match the actual package name
  if (version?.startsWith('npm:')) {
    const versionStartIndex = version.lastIndexOf('@');
    packageName = version.slice(4, versionStartIndex);
    version = version.slice(versionStartIndex + 1); // we don't need `@`
  }
  const node: LockFileNode = {
    name,
    ...(packageName && { packageName }),
    ...(version && { version }),
    ...(resolved && { resolved }),
    path,
    ...(dev && { dev }),
    ...(optional && { optional }),
    ...(devOptional && { devOptional }),
    ...(integrity && { integrity }),
    ...(peer && { peer }),
  };

  parseV1Dependencies(builder, node, value);
  builder.addNode(node.path, node);

  if (value.dependencies) {
    Object.entries(value.dependencies).forEach(([depName, depValue]) => {
      processV1Node(
        builder,
        depName,
        depValue,
        `${path}/node_modules/${depName}`
      );
    });
  }
}

// parse found dependencies into out edges
function parseV1Dependencies(
  builder: LockFileBuilder,
  node: LockFileNode,
  value: NpmDependencyV1
) {
  if (value.requires) {
    Object.entries(value.requires).forEach(([depName, depSpec]) => {
      addEdge(builder, node, depName, depSpec, 'unknown');
    });
  }
}

function parseV3LockFile(
  builder: LockFileBuilder,
  content: Omit<NpmLockFile, 'lockfileVersion'>
) {
  const { packages } = content;

  if (packages) {
    Object.entries(packages).forEach(([path, value]) => {
      if (path === '') {
        return; // skip root package (it's already added
      }

      const node = parseV3Node(path, value);
      parseV3Dependencies(builder, node, value);
      builder.addNode(path, node);
    });
  }
}

// parse node value from lock file into `LockFileNode`
function parseV3Node(path: string, value: NpmDependencyV3): LockFileNode {
  const { version, resolved, peer, optional, dev, name, integrity } = value;
  const devOptional = dev || optional || value.devOptional;
  const packageName = path.split('node_modules/').pop();
  const node: LockFileNode = {
    name: packageName,
    ...(name && name !== packageName && { packageName: name }),
    ...(version && { version }),
    ...(resolved && { resolved }),
    path,
    ...(dev && { dev }),
    ...(optional && { optional }),
    ...(devOptional && { devOptional }),
    ...(integrity && { integrity }),
    ...(peer && { peer }),
  };

  return node;
}

// parse found dependencies into out edges in V3/V2 lockfile
function parseV3Dependencies(
  builder: LockFileBuilder,
  node: LockFileNode,
  value: NpmDependencyV3
) {
  if (value.peerDependencies) {
    const peerMeta = value.peerDependenciesMeta || {};
    Object.entries(value.peerDependencies).forEach(([depName, depSpec]) => {
      if (peerMeta[depName]?.optional) {
        addEdge(builder, node, depName, depSpec, 'peerOptional');
      } else {
        addEdge(builder, node, depName, depSpec, 'peer');
      }
    });
  }
  if (value.dependencies) {
    Object.entries(value.dependencies).forEach(([depName, depSpec]) => {
      addEdge(builder, node, depName, depSpec, 'prod');
    });
  }
  if (value.optionalDependencies) {
    Object.entries(value.optionalDependencies).forEach(([depName, depSpec]) => {
      addEdge(builder, node, depName, depSpec, 'optional');
    });
  }
}
