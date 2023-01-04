import { parseSyml } from '@yarnpkg/parsers';
import { PackageJson } from '../utils/package-json';
import {
  LockFileBuilder,
  LockFileGraph,
  LockFileNode,
} from './utils/lock-file-builder';
import { workspaceRoot } from '../utils/workspace-root';
import { existsSync, readFileSync } from 'fs';

type YarnDependency = {
  version: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;

  // classic specific
  resolved?: string;
  integrity?: string;

  // berry specific
  resolution?: string;
  checksum?: string;
  languageName?: string;
  linkType?: 'soft' | 'hard';
};

export function parseYarnLockFile(
  lockFileContent: string,
  packageJson: PackageJson
): LockFileGraph {
  const { __metadata, ...dependencies } = parseSyml(lockFileContent);
  const isBerry = !!__metadata;

  const builder = new LockFileBuilder({ packageJson, lockFileContent });

  const groupedDependencies = groupDependencies(dependencies);
  isBerry
    ? parseBerryLockFile(builder, groupedDependencies)
    : parseClassicLockFile(builder, groupedDependencies);

  return builder.getLockFileGraph();
}

// Map Record<string, YarnDependency> to
// Map[packageName] -> Map[version] -> Set[key, YarnDependency]
function groupDependencies(
  dependencies: Record<string, YarnDependency>
): Map<string, Map<string, Set<[string, YarnDependency]>>> {
  const groupedDependencies = new Map<
    string,
    Map<string, Set<[string, YarnDependency]>>
  >();

  Object.entries(dependencies).forEach(([keyExp, value]) => {
    // Berry's parsed yaml keeps multiple version spec for the same version together
    // e.g. "foo@^1.0.0, foo@^1.1.0"
    const keys = keyExp.split(', ');
    const packageName = keys[0].slice(0, keys[0].indexOf('@', 1));

    keys.forEach((key) => {
      // we don't track patch dependencies (this is berry specific)
      if (key.startsWith(`${packageName}@patch:${packageName}`)) {
        return;
      }
      // we don't track workspace projects (this is berry specific)
      if (value.linkType === 'soft' || key.includes('@workspace:')) {
        return;
      }

      const valueSet = new Set<[string, YarnDependency]>().add([key, value]);
      if (!groupedDependencies.has(packageName)) {
        groupedDependencies.set(
          packageName,
          new Map([[value.version, valueSet]])
        );
      } else {
        const packageMap = groupedDependencies.get(packageName);
        if (packageMap.has(value.version)) {
          packageMap.get(value.version).add([key, value]);
        } else {
          packageMap.set(value.version, valueSet);
        }
      }
    });
  });

  return groupedDependencies;
}

function parseClassicLockFile(
  builder: LockFileBuilder,
  groupedDependencies: Map<string, Map<string, Set<[string, YarnDependency]>>>
) {
  // Non-root dependencies that need to be resolved later
  // Map[packageName, specKey, YarnDependency]
  const unresolvedDependencies = new Set<[string, string, YarnDependency]>();

  const isHoisted = true;

  groupedDependencies.forEach((versionMap, packageName) => {
    let rootVersion;
    if (versionMap.size === 1) {
      // If there is only one version, it is the root version
      rootVersion = versionMap.values().next().value.values().next()
        .value[1].version;
    } else {
      // Otherwise, we need to find the root version from the package.json
      rootVersion = getRootVersion(packageName);
    }
    versionMap.forEach((valueSet) => {
      const [key, dependency]: [string, YarnDependency] = valueSet
        .values()
        .next().value;
      const versionSpec = key.slice(packageName.length + 1);

      if (dependency.version === rootVersion) {
        const path = `node_modules/${packageName}`;
        const node = parseClassicNode(
          packageName,
          path,
          versionSpec,
          dependency,
          isHoisted
        );
        builder.addNode(path, node);
        valueSet.forEach(([newKey]) => {
          const newSpec = newKey.slice(packageName.length + 1);
          builder.addEdgeIn(node, newSpec);
        });
        if (dependency.dependencies) {
          Object.entries(dependency.dependencies).forEach(
            ([depName, depSpec]) => {
              builder.addEdgeOut(node, depName, depSpec);
            }
          );
        }
        if (dependency.optionalDependencies) {
          Object.entries(dependency.optionalDependencies).forEach(
            ([depName, depSpec]) => {
              builder.addEdgeOut(node, depName, depSpec, true);
            }
          );
        }
      } else {
        // we don't know the path yet, so we need to resolve non-root deps later
        unresolvedDependencies.add([packageName, versionSpec, dependency]);
      }
    });
  });

  // recursively resolve non-root dependencies
  // in each run we resolve one level of dependencies
  exhaustUnresolvedDependencies(builder, {
    unresolvedDependencies,
    isBerry: false,
  });
}

// find the top-most parent node that doesn't have the dependency
function findTopParentPath(
  builder: LockFileBuilder,
  parentNode: LockFileNode,
  packageName: string
): string {
  let path;
  while (!parentNode.children?.has(packageName)) {
    path = parentNode.path;
    const searchPath = `node_modules/${parentNode.name}`;
    if (path === searchPath) {
      parentNode = builder.nodes.get('');
    } else {
      parentNode = builder.nodes.get(path.slice(0, -(searchPath.length + 1)));
    }
  }
  return path;
}

function parseBerryLockFile(
  builder: LockFileBuilder,
  groupedDependencies: Map<string, Map<string, Set<[string, YarnDependency]>>>
) {
  // Non-root dependencies that need to be resolved later
  // Map[packageName, specKey, YarnDependency]
  const unresolvedDependencies = new Set<[string, string, YarnDependency]>();

  const isHoisted = true;

  groupedDependencies.forEach((versionMap, packageName) => {
    let rootVersion;
    if (versionMap.size === 1) {
      // If there is only one version, it is the root version
      rootVersion = versionMap.values().next().value.values().next()
        .value[1].version;
    } else {
      // Otherwise, we need to find the root version from the package.json
      rootVersion = getRootVersion(packageName);
    }

    versionMap.forEach((valueSet) => {
      const [key, value]: [string, YarnDependency] = valueSet
        .values()
        .next().value;

      if (value.version === rootVersion) {
        const path = `node_modules/${packageName}`;
        const node = parseBerryNode(packageName, path, value, isHoisted);
        builder.addNode(path, node);
        valueSet.forEach(([newKey]) => {
          const versionSpec = parseBerryVersionSpec(newKey, packageName);
          builder.addEdgeIn(node, versionSpec);
        });
        if (value.dependencies) {
          // Yarn keeps no notion of dev/peer/optional dependencies
          Object.entries(value.dependencies).forEach(([depName, depSpec]) => {
            builder.addEdgeOut(node, depName, depSpec);
          });
        }
      } else {
        const versionSpec = parseBerryVersionSpec(key, packageName);
        // we don't know the path yet, so we need to resolve non-root deps later
        unresolvedDependencies.add([packageName, versionSpec, value]);
      }
    });
  });

  exhaustUnresolvedDependencies(builder, {
    unresolvedDependencies,
    isBerry: true,
  });
}

function parseBerryVersionSpec(key: string, packageName: string) {
  const versionSpec = key.slice(packageName.length + 1);
  // if it's alias, we keep the `npm:` prefix
  if (versionSpec.startsWith('npm:') && !versionSpec.includes('@')) {
    return versionSpec.slice(4);
  }
  return versionSpec;
}

function parseClassicNode(
  packageName: string,
  path: string,
  versionSpec: string,
  value: YarnDependency,
  isHoisted = false
): LockFileNode {
  const { resolved, integrity } = value;

  // for alias packages, name would not match packageName
  const name = versionSpec.startsWith('npm:')
    ? versionSpec.slice(4, versionSpec.lastIndexOf('@'))
    : packageName;

  let version = value.version;
  // for tarball packages version might not exist or be useless
  if (!version || (resolved && !resolved.includes(version))) {
    version = resolved;
  }

  const node: LockFileNode = {
    name: packageName,
    ...(name !== packageName && { packageName: name }),
    ...(version && { version }),
    ...(integrity && { integrity }),
    path,
    isHoisted,
  };

  return node;
}

function parseBerryNode(
  packageName: string,
  path: string,
  value: YarnDependency,
  isHoisted = false
): LockFileNode {
  const { resolution, checksum } = value;

  // for alias packages, name would not match packageName
  const name = resolution.slice(0, resolution.indexOf('@', 1));

  let version = value.version;
  // for tarball packages version might not exist or be useless
  if (!version || (resolution && !resolution.includes(version))) {
    version = resolution.slice(resolution.indexOf('@', 1) + 1);
  }

  const node: LockFileNode = {
    name: packageName,
    ...(name !== packageName && { packageName: name }),
    ...(version && { version }),
    ...(checksum && { integrity: checksum }),
    path,
    isHoisted,
  };

  return node;
}

function exhaustUnresolvedDependencies(
  builder: LockFileBuilder,
  {
    unresolvedDependencies,
    isBerry,
  }: {
    unresolvedDependencies: Set<[string, string, YarnDependency]>;
    isBerry: boolean;
  }
) {
  const initialSize = unresolvedDependencies.size;
  unresolvedDependencies.forEach((unresolvedSet) => {
    const [packageName, versionSpec, value] = unresolvedSet;

    for (const n of builder.nodes.values()) {
      if (n.edgesOut && n.edgesOut.has(packageName)) {
        const edge = n.edgesOut.get(packageName);

        if (edge.versionSpec === versionSpec) {
          const parentPath = findTopParentPath(builder, n, packageName);
          const path = `${parentPath}/node_modules/${packageName}`;
          const node = isBerry
            ? parseBerryNode(packageName, path, value)
            : parseClassicNode(packageName, path, versionSpec, value);

          builder.addNode(path, node);
          if (value.dependencies) {
            // Yarn classic keeps no notion of dev/peer/optional dependencies
            Object.entries(value.dependencies).forEach(([depName, depSpec]) => {
              builder.addEdgeOut(node, depName, depSpec);
            });
          }
          unresolvedDependencies.delete(unresolvedSet);
          return;
        }
      }
    }
  });
  if (initialSize === unresolvedDependencies.size) {
    throw new Error(
      `Could not resolve following dependencies\n` +
        Array.from(unresolvedDependencies)
          .map(
            ([packageName, versionSpec]) => `- ${packageName}@${versionSpec}\n`
          )
          .join('') +
        `Breaking out of the parsing to avoid infinite loop.`
    );
  }
  if (unresolvedDependencies.size > 0) {
    exhaustUnresolvedDependencies(builder, { unresolvedDependencies, isBerry });
  }
}

function getRootVersion(packageName: string): string {
  const fullPath = `${workspaceRoot}/node_modules/${packageName}/package.json`;

  if (existsSync(fullPath)) {
    const content = readFileSync(fullPath, 'utf-8');
    return JSON.parse(content).version;
  } else {
    throw new Error(
      `Could not find package.json for "${packageName}" at "${fullPath}"`
    );
  }
}
