import { PackageJson } from '../../utils/package-json';
import { NpmDependencyV1, NpmDependencyV3 } from './types';

function v1VersionResolver(
  packages: Record<string, NpmDependencyV1>,
  depName: string,
  parentPath: string
): string {
  if (parentPath && packages[parentPath].dependencies?.[depName]) {
    return packages[parentPath].dependencies[depName].version;
  }
  return packages[depName].version;
}

function v3VersionResolver(
  packages: Record<string, NpmDependencyV3>,
  depName: string,
  parentPath
): string {
  let { resolved, version, name } =
    packages[`${parentPath ? parentPath + '/' : ''}node_modules/${depName}`];
  if (!version || (resolved && !resolved.includes(version))) {
    return resolved;
  } else if (name) {
    return `npm:${name}@${version}`;
  }
  return version;
}

function normalizeDependencySection(
  packages: Record<string, NpmDependencyV1 | NpmDependencyV3>,
  section: Record<string, string>,
  isLockFileV1: boolean,
  parentPath = ''
): Record<string, string> {
  const normalizedSection: Record<string, string> = {};
  Object.keys(section).forEach((depName) => {
    normalizedSection[depName] = isLockFileV1
      ? v1VersionResolver(
          packages as Record<string, NpmDependencyV1>,
          depName,
          parentPath
        )
      : v3VersionResolver(
          packages as Record<string, NpmDependencyV3>,
          depName,
          parentPath
        );
  });
  return normalizedSection;
}

export function normalizeNpmPackageJson(
  packageJson: PackageJson,
  packages: Record<string, NpmDependencyV1 | NpmDependencyV3>,
  {
    isLockFileV1,
    parentPath,
  }: { isLockFileV1?: boolean; parentPath?: string } = {}
): Partial<PackageJson> {
  const {
    dependencies,
    devDependencies,
    peerDependencies,
    peerDependenciesMeta,
  } = packageJson;

  const normalizeDependencies = (section) =>
    normalizeDependencySection(packages, section, isLockFileV1, parentPath);

  return {
    ...(dependencies && {
      dependencies: normalizeDependencies(dependencies),
    }),
    ...(devDependencies && {
      devDependencies: normalizeDependencies(devDependencies),
    }),
    ...(peerDependencies && {
      peerDependencies: normalizeDependencies(peerDependencies),
    }),
    ...(peerDependenciesMeta && { peerDependenciesMeta }),
  };
}
