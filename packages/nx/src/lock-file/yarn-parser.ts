import { parseSyml, stringifySyml } from '@yarnpkg/parsers';
import { stringify } from '@yarnpkg/lockfile';
import { PackageJson } from '../utils/package-json';
import { LockFileBuilder, nodeKey } from './lock-file-builder';
import { LockFileGraph, LockFileNode, YarnDependency } from './utils/types';
import { sortObjectByKeys } from '../utils/object-sort';
import {
  BERRY_LOCK_FILE_DISCLAIMER,
  generateRootWorkspacePackage,
  isAliasDependency,
  isTarballDependency,
} from './utils/yarn-utils';
import {
  addEdgeOuts,
  getRootVersion,
  reportUnresolvedDependencies,
  UnresolvedDependencies,
} from './utils/parsing-utils';

export function parseYarnLockFile(
  lockFileContent: string,
  packageJson: PackageJson
): LockFileGraph {
  const { __metadata, ...dependencies } = parseSyml(lockFileContent);
  const isBerry = !!__metadata;
  const groupedDependencies = groupDependencies(dependencies);

  const builder = buildLockFileGraph(groupedDependencies, packageJson, isBerry);

  return builder.getLockFileGraph();
}

export function pruneYarnLockFile(
  rootLockFileContent: string,
  packageJson: PackageJson,
  prunedPackageJson: PackageJson
): string {
  const { __metadata, ...dependencies } = parseSyml(rootLockFileContent);
  const isBerry = !!__metadata;
  const groupedDependencies = groupDependencies(dependencies);

  const builder = buildLockFileGraph(groupedDependencies, packageJson, isBerry);
  builder.prune(prunedPackageJson);

  const output: Record<string, YarnDependency> = {};
  builder.nodes.forEach((node) => {
    const value = groupedDependencies
      .get(node.name)
      .get(node.version)
      .values()
      .next().value[1];

    const keys = new Set<string>();
    node.edgesIn.forEach((edge) => {
      const version =
        isBerry &&
        !isAliasDependency(edge.versionSpec) &&
        !isTarballDependency(value)
          ? `npm:${edge.versionSpec}`
          : edge.versionSpec;
      keys.add(`${node.name}@${version}`);
    });

    const sortedKeys = Array.from(keys).sort();

    if (isBerry) {
      output[Array.from(keys).sort().join(', ')] = value;
    } else {
      sortedKeys.forEach((key) => {
        output[key] = value;
      });
    }
  });

  if (isBerry) {
    // add root workspace package
    const workspacePackage = generateRootWorkspacePackage(prunedPackageJson);
    output[workspacePackage.resolution] = workspacePackage;

    return (
      BERRY_LOCK_FILE_DISCLAIMER +
      stringifySyml({
        __metadata,
        dependencies: sortObjectByKeys(output),
      })
    );
  } else {
    return stringify(sortObjectByKeys(output));
  }
}

function buildLockFileGraph(
  groupedDependencies: Map<string, Map<string, Set<[string, YarnDependency]>>>,
  packageJson: PackageJson,
  isBerry: boolean
): LockFileBuilder {
  const builder = new LockFileBuilder(packageJson, { includeOptional: true });

  isBerry
    ? parseBerryLockFile(builder, groupedDependencies)
    : parseClassicLockFile(builder, groupedDependencies);

  return builder;
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

      if (dependency.version === rootVersion) {
        const versionSpec = key.slice(packageName.length + 1);
        const node = parseClassicNode(
          packageName,
          versionSpec,
          dependency,
          isHoisted
        );
        builder.addNode(node);
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
        valueSet.forEach(([newKey]) => {
          const versionSpec = newKey.slice(packageName.length + 1);
          // we don't know the path yet, so we need to resolve non-root deps later
          unresolvedDependencies.add([packageName, versionSpec, dependency]);
        });
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
      const [_, value]: [string, YarnDependency] = valueSet
        .values()
        .next().value;

      if (value.version === rootVersion) {
        const node = parseBerryNode(packageName, value, isHoisted);
        builder.addNode(node);
        valueSet.forEach(([key]) => {
          const versionSpec = parseBerryVersionSpec(key, packageName);
          builder.addEdgeIn(node, versionSpec);
        });
        addEdgeOuts({ builder, node, section: value.dependencies });
        addEdgeOuts({
          builder,
          node,
          section: value.optionalDependencies,
          isOptional: true,
        });
      } else {
        valueSet.forEach(([key]) => {
          const versionSpec = parseBerryVersionSpec(key, packageName);
          // we don't know the path yet, so we need to resolve non-root deps later
          unresolvedDependencies.add([packageName, versionSpec, value]);
        });
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
  versionSpec: string,
  value: YarnDependency,
  isHoisted = false
): LockFileNode {
  // for alias packages, name would not match packageName
  const name = versionSpec.startsWith('npm:')
    ? versionSpec.slice(4, versionSpec.lastIndexOf('@'))
    : packageName;

  let version = value.version;
  // for tarball packages version might not exist or be useless
  const resolved = value.resolved;
  if (!version || (resolved && !resolved.includes(version))) {
    version = resolved;
  }

  const node: LockFileNode = {
    name: packageName,
    ...(name !== packageName && { packageName: name }),
    ...(version && { version }),
    isHoisted,
  };

  return node;
}

function parseBerryNode(
  packageName: string,
  value: YarnDependency,
  isHoisted = false
): LockFileNode {
  const resolution = value.resolution;

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
    unresolvedDependencies: UnresolvedDependencies<YarnDependency>;
    isBerry: boolean;
  }
) {
  const initialSize = unresolvedDependencies.size;
  if (!initialSize) {
    return;
  }

  unresolvedDependencies.forEach((unresolvedSet) => {
    const [packageName, versionSpec, value] = unresolvedSet;

    for (const n of builder.nodes.values()) {
      if (n.edgesOut && n.edgesOut.has(packageName)) {
        const edge = n.edgesOut.get(packageName);

        if (edge.versionSpec === versionSpec) {
          const node = isBerry
            ? parseBerryNode(packageName, value)
            : parseClassicNode(packageName, versionSpec, value);

          // we might have added the node already
          if (!builder.nodes.has(nodeKey(node))) {
            builder.addNode(node);
            builder.addEdgeIn(node, versionSpec);
            addEdgeOuts({ builder, node, section: value.dependencies });
            addEdgeOuts({
              builder,
              node,
              section: value.optionalDependencies,
              isOptional: true,
            });
          } else {
            const existingNode = builder.nodes.get(nodeKey(node));
            builder.addEdgeIn(existingNode, versionSpec);
          }
          unresolvedDependencies.delete(unresolvedSet);
          return;
        }
      }
    }
  });
  if (initialSize === unresolvedDependencies.size) {
    reportUnresolvedDependencies(unresolvedDependencies);
  } else if (unresolvedDependencies.size > 0) {
    exhaustUnresolvedDependencies(builder, { unresolvedDependencies, isBerry });
  }
}
