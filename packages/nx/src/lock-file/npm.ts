import { existsSync, readFileSync } from 'fs';
import { PackageJson } from '../utils/package-json';
import { workspaceRoot } from '../utils/workspace-root';
import { LockFileBuilder } from './utils/lock-file-builder';
import {
  LockFileGraph,
  LockFileNode,
  NpmDependencyV1,
  NpmDependencyV3,
  NpmLockFile,
} from './utils/types';
import { satisfies } from 'semver';

export function parseNpmLockFile(
  lockFileContent: string,
  packageJson: PackageJson
): LockFileGraph {
  const builder = buildLockFileGraph(lockFileContent, packageJson);
  return builder.getLockFileGraph();
}

export function pruneNpmLockFile(
  rootLockFileContent: string,
  packageJson: PackageJson,
  prunedPackageJson: PackageJson
): string {
  const builder = buildLockFileGraph(rootLockFileContent, packageJson);
  builder.prune(prunedPackageJson);

  return rootLockFileContent;
}

function buildLockFileGraph(
  lockFileContent: string,
  packageJson: PackageJson
): LockFileBuilder {
  const data = JSON.parse(lockFileContent) as NpmLockFile;

  const isLockFileV1 = data.lockfileVersion === 1;

  const normalizedPackageJson = isLockFileV1
    ? normalizeV1PackageJson(packageJson, data.dependencies)
    : normalizeV3PackageJson(packageJson, data.packages);

  const builder = new LockFileBuilder(normalizedPackageJson, {
    includeOptional: true,
  });

  isLockFileV1
    ? parseV1LockFile(builder, data.dependencies)
    : parseV3LockFile(builder, data.packages); // we will treat V2 lockfile as V3 but map it back to V2 for backwards compatibility

  return builder;
}

/**********************************************
 * V3 lock file related logic
 *********************************************/

function normalizeV1PackageJson(
  packageJson: PackageJson,
  packages: Record<string, NpmDependencyV1>
): Partial<PackageJson> {
  const {
    dependencies,
    devDependencies,
    peerDependencies,
    peerDependenciesMeta,
  } = packageJson;

  const normalizeDependencySection = (
    section: Record<string, string>
  ): Record<string, string> => {
    const normalizedSection: Record<string, string> = {};
    Object.keys(section).forEach((depName) => {
      normalizedSection[depName] = packages[depName].version;
    });
    return normalizedSection;
  };

  return {
    ...(dependencies && {
      dependencies: normalizeDependencySection(dependencies),
    }),
    ...(devDependencies && {
      devDependencies: normalizeDependencySection(devDependencies),
    }),
    ...(peerDependencies && {
      peerDependencies: normalizeDependencySection(peerDependencies),
    }),
    ...(peerDependenciesMeta && { peerDependenciesMeta }),
  };
}

function parseV1LockFile(
  builder: LockFileBuilder,
  dependencies: Record<string, NpmDependencyV1>
) {
  if (dependencies) {
    Object.entries(dependencies).forEach(([packageName, value]) => {
      parseV1Dependency(dependencies, packageName, value, builder);
    });
  }
}

function parseV1Dependency(
  dependencies: Record<string, NpmDependencyV1>,
  packageName: string,
  value: NpmDependencyV1,
  builder: LockFileBuilder,
  { isHoisted, parents }: { isHoisted: boolean; parents: string[] } = {
    isHoisted: true,
    parents: [],
  }
) {
  const node = parseV1Node(packageName, value, isHoisted);
  builder.addNode(node);
  builder.addEdgeIn(node, value.version);

  const pathSegments = [...parents, packageName];
  if (value.requires) {
    Object.entries(value.requires).forEach(([depName, depSpec]) => {
      const matchedVersion = findV1EdgeVersion(
        dependencies,
        pathSegments,
        depName,
        depSpec
      );
      builder.addEdgeOut(node, depName, matchedVersion);
    });
  }
  const { peerDependencies, peerDependenciesMeta } = getPeerDependencies(
    `node_modules/${pathSegments.join('/node_modules/')}`
  );
  if (peerDependencies) {
    Object.entries(peerDependencies).forEach(([depName, depSpec]) => {
      if (!node.edgesOut?.has(depName)) {
        const isOptional = peerDependenciesMeta?.[depName]?.optional;
        let matchedVersion = findV1EdgeVersion(
          dependencies,
          pathSegments,
          depName,
          depSpec
        );
        if (!matchedVersion && isOptional) {
          matchedVersion = depSpec;
        }
        builder.addEdgeOut(node, depName, matchedVersion, isOptional);
      }
    });
  }

  if (value.dependencies) {
    Object.entries(value.dependencies).forEach(([depPackageName, depValue]) => {
      parseV1Dependency(dependencies, depPackageName, depValue, builder, {
        isHoisted: false,
        parents: pathSegments,
      });
    });
  }
}

function findV1EdgeVersion(
  dependencies: Record<string, NpmDependencyV1>,
  pathSegments: string[],
  name: string,
  versionSpec: string
): string {
  if (!dependencies && !pathSegments.length) {
    return;
  }
  let version;
  const depVersion = dependencies[name]?.version;
  if (depVersion && satisfies(depVersion, versionSpec)) {
    version = depVersion;
  }
  if (!pathSegments.length) {
    return version;
  }
  return (
    findV1EdgeVersion(
      dependencies[pathSegments[0]].dependencies,
      pathSegments.slice(1),
      name,
      versionSpec
    ) || version
  );
}

function parseV1Node(
  name: string,
  value: NpmDependencyV1,
  isHoisted = false
): LockFileNode {
  let version = value.version;
  let packageName;

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
    isHoisted,
  };
  return node;
}

// NPM V1 does not track the peer dependencies in the lock file
// so we need to parse them directly from the package.json
function getPeerDependencies(path: string): {
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional: boolean }>;
} {
  const fullPath = `${workspaceRoot}/${path}/package.json`;

  if (existsSync(fullPath)) {
    const content = readFileSync(fullPath, 'utf-8');
    const { peerDependencies, peerDependenciesMeta } = JSON.parse(content);
    return {
      ...(peerDependencies && { peerDependencies }),
      ...(peerDependenciesMeta && { peerDependenciesMeta }),
    };
  } else {
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.warn(`Could not find package.json at "${path}"`);
    }
    return {};
  }
}

/**********************************************
 * V3 lock file related logic
 *********************************************/

function normalizeV3PackageJson(
  packageJson: PackageJson,
  packages: Record<string, NpmDependencyV3>
): Partial<PackageJson> {
  const {
    dependencies,
    devDependencies,
    peerDependencies,
    peerDependenciesMeta,
  } = packageJson;

  const normalizeDependencySection = (
    section: Record<string, string>
  ): Record<string, string> => {
    const normalizedSection: Record<string, string> = {};
    Object.keys(section).forEach((depName) => {
      let { resolved, version, name } = packages[`node_modules/${depName}`];
      if (!version || (resolved && !resolved.includes(version))) {
        version = resolved;
      } else if (name) {
        version = `npm:${name}@${version}`;
      }
      normalizedSection[depName] = version;
    });
    return normalizedSection;
  };

  return {
    ...(dependencies && {
      dependencies: normalizeDependencySection(dependencies),
    }),
    ...(devDependencies && {
      devDependencies: normalizeDependencySection(devDependencies),
    }),
    ...(peerDependencies && {
      peerDependencies: normalizeDependencySection(peerDependencies),
    }),
    ...(peerDependenciesMeta && { peerDependenciesMeta }),
  };
}

function parseV3LockFile(
  builder: LockFileBuilder,
  packages: Record<string, NpmDependencyV3>
) {
  if (packages) {
    Object.entries(packages).forEach(([path, value]) => {
      if (path === '') {
        return; // skip root package (it's already added
      }

      const node = parseV3Node(path, value);
      builder.addNode(node);
      builder.addEdgeIn(
        node,
        node.packageName
          ? `npm:${node.packageName}@${node.version}`
          : node.version
      );
      if (value.peerDependencies) {
        const peerMeta = value.peerDependenciesMeta || {};
        Object.entries(value.peerDependencies).forEach(([depName, depSpec]) => {
          builder.addEdgeOut(
            node,
            depName,
            findV3EdgeVersion(
              packages,
              path,
              depName,
              depSpec,
              peerMeta[depName]?.optional
            ),
            peerMeta[depName]?.optional
          );
        });
      }
      if (value.dependencies) {
        Object.entries(value.dependencies).forEach(([depName, depSpec]) => {
          builder.addEdgeOut(
            node,
            depName,
            findV3EdgeVersion(packages, path, depName, depSpec)
          );
        });
      }
      if (value.optionalDependencies) {
        Object.entries(value.optionalDependencies).forEach(
          ([depName, depSpec]) => {
            builder.addEdgeOut(
              node,
              depName,
              findV3EdgeVersion(packages, path, depName, depSpec)
            );
          }
        );
      }
    });
  }
}

function findV3EdgeVersion(
  packages: Record<string, NpmDependencyV3>,
  path: string,
  name: string,
  versionSpec: string,
  optional?: boolean
): string {
  if (path && !path.endsWith('/')) {
    path = path + '/';
  }
  let child = packages[`${path}node_modules/${name}`];
  if (child && satisfies(child.version, versionSpec)) {
    return child.version;
  }
  if (!path) {
    if (!optional) {
      throw `Could not find version for ${name} with spec ${versionSpec} in the lock file`;
    }
    return versionSpec;
  }
  const parentPath = path.slice(0, path.lastIndexOf('node_modules'));
  return findV3EdgeVersion(packages, parentPath, name, versionSpec, optional);
}

// parse node value from lock file into `LockFileNode`
function parseV3Node(path: string, value: NpmDependencyV3): LockFileNode {
  const { resolved, name } = value;
  const packageName = path.split('node_modules/').pop();

  let version = value.version;
  // for tarball packages version might not exist or be useless
  if (!version || (resolved && !resolved.includes(version))) {
    version = resolved;
  }

  const isHoisted = !path.includes('/node_modules/');

  const node: LockFileNode = {
    name: packageName,
    ...(name && name !== packageName && { packageName: name }),
    ...(version && { version }),
    isHoisted,
  };

  return node;
}
