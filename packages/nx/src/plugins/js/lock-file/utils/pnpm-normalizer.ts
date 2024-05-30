/**
 * This file contains the logic to convert pnpm lockfile to a standard format.
 * It will convert inline specifiers to the separate specifiers format and ensure importers are present.
 */

import type {
  InlineSpecifiersLockfile,
  InlineSpecifiersProjectSnapshot,
  InlineSpecifiersResolvedDependencies,
  Lockfile,
  LockfileFile,
  PackageInfo,
  PackageSnapshot,
  PackageSnapshotV7,
  PackageSnapshots,
  ProjectSnapshot,
  ResolvedDependencies,
} from '@pnpm/lockfile-types';
import { existsSync, readFileSync } from 'fs';
import { valid } from 'semver';
import { workspaceRoot } from '../../../../utils/workspace-root';
import { hashObject } from '../../../../hasher/file-hasher';

export function isV5Syntax(data: {
  lockfileVersion: number | string;
}): boolean {
  if (+data.lockfileVersion.toString() >= 6) {
    return false;
  } else {
    return true;
  }
}

export function usesLeadingDash(data: { lockfileVersion: number | string }) {
  if (+data.lockfileVersion.toString() >= 9) {
    false;
  } else {
    return true;
  }
}

export function loadPnpmHoistedDepsDefinition() {
  const fullPath = `${workspaceRoot}/node_modules/.modules.yaml`;

  if (existsSync(fullPath)) {
    const content = readFileSync(fullPath, 'utf-8');
    const { load } = require('@zkochan/js-yaml');
    return load(content)?.hoistedDependencies ?? {};
  } else {
    throw new Error(`Could not find ".modules.yaml" at "${fullPath}"`);
  }
}

/**
 * Parsing and mapping logic from pnpm lockfile `read` function
 */
export function parseAndNormalizePnpmLockfile(content: string): Lockfile {
  const { load } = require('@zkochan/js-yaml');
  return convertToLockfileObject(load(content));
}

// https://github.com/pnpm/pnpm/blob/50e37072f42bcca6d393a74bed29f7f0e029805d/lockfile/lockfile-file/src/write.ts#L22
const LOCKFILE_YAML_FORMAT = {
  blankLines: true,
  lineWidth: -1, // This is setting line width to never wrap
  noCompatMode: true,
  noRefs: true,
  sortKeys: false,
};

const LOCKFILE_YAML_PRE9_FORMAT = {
  ...LOCKFILE_YAML_FORMAT,
  lineWidth: 1000,
};

/**
 * Mapping and writing logic from pnpm lockfile `write` function
 */
export function stringifyToPnpmYaml(lockfile: Lockfile): string {
  const { dump } = require('@zkochan/js-yaml');
  const lockfileVersion = +lockfile.lockfileVersion;
  if (lockfileVersion >= 9) {
    const adaptedLockfile = convertToLockfileFile(lockfile, {
      forceSharedFormat: true,
    });
    return dump(sortLockfileKeys(adaptedLockfile), LOCKFILE_YAML_FORMAT);
  } else {
    // https://github.com/pnpm/pnpm/blob/af3e5559d377870d4c3d303429b3ed1a4e64fedc/lockfile/lockfile-file/src/write.ts#L77
    const adaptedLockfile =
      lockfileVersion >= 6
        ? convertToInlineSpecifiersFormat(lockfile)
        : lockfile;

    return dump(
      sortLockfileKeys(
        normalizeLockfileV6(adaptedLockfile as Lockfile, lockfileVersion >= 6)
      ),
      LOCKFILE_YAML_PRE9_FORMAT
    );
  }
}

/**
 * The following code was copied over from pnpm source code and modified to work in this context.
 */

// https://github.com/pnpm/pnpm/blob/af3e5559d377870d4c3d303429b3ed1a4e64fedc/lockfile/lockfile-file/src/experiments/inlineSpecifiersLockfileConverters.ts#L17
function convertToInlineSpecifiersFormat(
  lockfile: Lockfile
): InlineSpecifiersLockfile {
  let importers = lockfile.importers;
  let packages = lockfile.packages;
  importers = Object.fromEntries(
    Object.entries(lockfile.importers ?? {}).map(
      ([importerId, pkgSnapshot]: [string, ProjectSnapshot]) => {
        const newSnapshot = { ...pkgSnapshot };
        if (newSnapshot.dependencies != null) {
          newSnapshot.dependencies = mapValues(
            newSnapshot.dependencies,
            convertOldRefToNewRef
          );
        }
        if (newSnapshot.optionalDependencies != null) {
          newSnapshot.optionalDependencies = mapValues(
            newSnapshot.optionalDependencies,
            convertOldRefToNewRef
          );
        }
        if (newSnapshot.devDependencies != null) {
          newSnapshot.devDependencies = mapValues(
            newSnapshot.devDependencies,
            convertOldRefToNewRef
          );
        }
        return [importerId, newSnapshot];
      }
    )
  );
  packages = Object.fromEntries(
    Object.entries(lockfile.packages ?? {}).map(([depPath, pkgSnapshot]) => {
      const newSnapshot = { ...pkgSnapshot };
      if (newSnapshot.dependencies != null) {
        newSnapshot.dependencies = mapValues(
          newSnapshot.dependencies,
          convertOldRefToNewRef
        );
      }
      if (newSnapshot.optionalDependencies != null) {
        newSnapshot.optionalDependencies = mapValues(
          newSnapshot.optionalDependencies,
          convertOldRefToNewRef
        );
      }
      return [convertOldDepPathToNewDepPath(depPath), newSnapshot];
    })
  );
  const newLockfile = {
    ...lockfile,
    packages,
    lockfileVersion: lockfile.lockfileVersion.toString(),
    importers: mapValues(
      importers,
      convertProjectSnapshotToInlineSpecifiersFormat
    ),
  };
  if (newLockfile.time) {
    newLockfile.time = Object.fromEntries(
      Object.entries(newLockfile.time).map(([depPath, time]) => [
        convertOldDepPathToNewDepPath(depPath),
        time,
      ])
    );
  }
  return newLockfile;
}

// https://github.com/pnpm/pnpm/blob/af3e5559d377870d4c3d303429b3ed1a4e64fedc/lockfile/lockfile-file/src/experiments/inlineSpecifiersLockfileConverters.ts#L72
function convertOldDepPathToNewDepPath(oldDepPath: string) {
  const parsedDepPath = dpParse(oldDepPath);
  if (!parsedDepPath.name || !parsedDepPath.version) return oldDepPath;
  let newDepPath = `/${parsedDepPath.name}@${parsedDepPath.version}`;
  if (parsedDepPath.peersSuffix) {
    if (parsedDepPath.peersSuffix.startsWith('(')) {
      newDepPath += parsedDepPath.peersSuffix;
    } else {
      newDepPath += `_${parsedDepPath.peersSuffix}`;
    }
  }
  if (parsedDepPath.host) {
    newDepPath = `${parsedDepPath.host}${newDepPath}`;
  }
  return newDepPath;
}

// https://github.com/pnpm/pnpm/blob/af3e5559d377870d4c3d303429b3ed1a4e64fedc/lockfile/lockfile-file/src/experiments/inlineSpecifiersLockfileConverters.ts#L89
function convertOldRefToNewRef(oldRef: string) {
  if (oldRef.startsWith('link:') || oldRef.startsWith('file:')) {
    return oldRef;
  }
  if (oldRef.includes('/')) {
    return convertOldDepPathToNewDepPath(oldRef);
  }
  return oldRef;
}

// https://github.com/pnpm/pnpm/blob/af3e5559d377870d4c3d303429b3ed1a4e64fedc/lockfile/lockfile-file/src/experiments/inlineSpecifiersLockfileConverters.ts#L179
function convertProjectSnapshotToInlineSpecifiersFormat(
  projectSnapshot: ProjectSnapshot
): InlineSpecifiersProjectSnapshot {
  const { specifiers, ...rest } = projectSnapshot;
  const convertBlock = (block?: ResolvedDependencies) =>
    block != null
      ? convertResolvedDependenciesToInlineSpecifiersFormat(block, {
          specifiers,
        })
      : block;
  return {
    ...rest,
    dependencies: convertBlock(projectSnapshot.dependencies),
    optionalDependencies: convertBlock(projectSnapshot.optionalDependencies),
    devDependencies: convertBlock(projectSnapshot.devDependencies),
  } as InlineSpecifiersProjectSnapshot;
}

// https://github.com/pnpm/pnpm/blob/af3e5559d377870d4c3d303429b3ed1a4e64fedc/lockfile/lockfile-file/src/experiments/inlineSpecifiersLockfileConverters.ts#L195
function convertResolvedDependenciesToInlineSpecifiersFormat(
  resolvedDependencies: ResolvedDependencies,
  { specifiers }: { specifiers: ResolvedDependencies }
): InlineSpecifiersResolvedDependencies {
  return mapValues(resolvedDependencies, (version, depName) => ({
    specifier: specifiers[depName],
    version,
  }));
}

// https://github.com/pnpm/pnpm/blob/cca56c0c6c956d036883003092ca1d11bbb700f6/lockfile/lockfile-types/src/lockfileFileTypes.ts#L8
type LockfileFileV9 = Omit<InlineSpecifiersLockfile, 'importers' | 'packages'> &
  Partial<InlineSpecifiersProjectSnapshot> &
  Partial<Pick<InlineSpecifiersLockfile, 'importers'>> & {
    packages?: Record<
      string,
      Pick<
        PackageSnapshot,
        | 'resolution'
        | 'engines'
        | 'cpu'
        | 'os'
        | 'hasBin'
        | 'name'
        | 'version'
        | 'bundledDependencies'
        | 'peerDependencies'
        | 'peerDependenciesMeta'
        | 'deprecated'
      >
    >;
    snapshots?: Record<
      string,
      Pick<
        PackageSnapshot,
        | 'dependencies'
        | 'optionalDependencies'
        | 'patched'
        | 'optional'
        | 'transitivePeerDependencies'
        | 'id'
      >
    >;
  };

// https://github.com/pnpm/pnpm/blob/af3e5559d377870d4c3d303429b3ed1a4e64fedc/packages/types/src/misc.ts#L6
const DEPENDENCIES_FIELDS = [
  'optionalDependencies',
  'dependencies',
  'devDependencies',
];

// https://github.com/pnpm/pnpm/blob/cca56c0c6c956d036883003092ca1d11bbb700f6/lockfile/lockfile-file/src/lockfileFormatConverters.ts#L169
function convertFromLockfileFileMutable(
  lockfileFile: LockfileFile
): LockfileFileV9 {
  if (typeof lockfileFile?.['importers'] === 'undefined') {
    lockfileFile.importers = {
      '.': {
        dependenciesMeta: lockfileFile['dependenciesMeta'],
        publishDirectory: lockfileFile['publishDirectory'],
      },
    };
    for (const depType of DEPENDENCIES_FIELDS) {
      if (lockfileFile[depType] != null) {
        lockfileFile.importers['.'][depType] = lockfileFile[depType];
        delete lockfileFile[depType];
      }
    }
  } else if (isV5Syntax(lockfileFile)) {
    // remap the importers from v5 to the new format
    for (const depType of DEPENDENCIES_FIELDS) {
      if (lockfileFile.importers['.'][depType]) {
        for (const [depName, version] of Object.entries(
          lockfileFile.importers['.'][depType]
        )) {
          lockfileFile.importers['.'][depType][depName] = {
            version,
            specifier: (lockfileFile['specifiers'] ||
              lockfileFile.importers['.']['specifiers'])[depName],
          };
        }
      }
    }
  }
  return lockfileFile as InlineSpecifiersLockfile;
}

// https://github.com/pnpm/pnpm/blob/cca56c0c6c956d036883003092ca1d11bbb700f6/lockfile/lockfile-file/src/lockfileFormatConverters.ts#L187
function convertToLockfileObject(
  lockfile: LockfileFile | LockfileFileV9
): Lockfile {
  if ((lockfile as LockfileFileV9).snapshots) {
    return convertLockfileV9ToLockfileObject(lockfile as LockfileFileV9);
  }
  convertPkgIds(lockfile);
  const { importers, ...rest } = convertFromLockfileFileMutable(lockfile);

  const newLockfile = {
    ...rest,
    importers: mapValues(importers ?? {}, revertProjectSnapshot),
  };
  return newLockfile;
}

// https://github.com/pnpm/pnpm/blob/cca56c0c6c956d036883003092ca1d11bbb700f6/lockfile/lockfile-file/src/lockfileFormatConverters.ts#L201
function convertPkgIds(lockfile: LockfileFile): void {
  const oldIdToNewId: Record<string, string> = {};
  if (lockfile.packages == null || isEmpty(lockfile.packages)) return;
  for (const [pkgId, pkg] of Object.entries(lockfile.packages ?? {})) {
    if (pkg.name) {
      const { id, peersSuffix } = parseDepPath(pkgId);
      let newId = `${pkg.name}@`;
      if ('tarball' in pkg.resolution) {
        newId += pkg.resolution.tarball;
        if (pkg.resolution.path) {
          newId += `#path:${pkg.resolution.path}`;
        }
      } else if ('repo' in pkg.resolution) {
        newId += createGitHostedPkgId(pkg.resolution);
      } else if ('directory' in pkg.resolution) {
        newId += id;
      } else {
        continue;
      }
      oldIdToNewId[pkgId] = `${newId}${peersSuffix}`;
      if (id !== pkgId) {
        oldIdToNewId[id] = newId;
      }
    } else {
      const { id, peersSuffix } = parseDepPath(pkgId);
      const newId = id.substring(1);
      oldIdToNewId[pkgId] = `${newId}${peersSuffix}`;
      if (id !== pkgId) {
        oldIdToNewId[id] = newId;
      }
    }
  }
  const newLockfilePackages: PackageSnapshots = {};
  for (const [pkgId, pkg] of Object.entries(lockfile.packages ?? {})) {
    if (oldIdToNewId[pkgId]) {
      if (pkg.id) {
        pkg.id = oldIdToNewId[pkg.id];
      }
      newLockfilePackages[oldIdToNewId[pkgId]] = pkg;
    } else {
      newLockfilePackages[pkgId] = pkg;
    }
    for (const depType of ['dependencies', 'optionalDependencies'] as const) {
      for (const [alias, depPath] of Object.entries(pkg[depType] ?? {})) {
        if (oldIdToNewId[depPath]) {
          if (oldIdToNewId[depPath].startsWith(`${alias}@`)) {
            pkg[depType]![alias] = oldIdToNewId[depPath].substring(
              alias.length + 1
            );
          } else {
            pkg[depType]![alias] = oldIdToNewId[depPath];
          }
        }
      }
    }
  }
  lockfile.packages = newLockfilePackages;
  if (
    (lockfile.dependencies != null ||
      lockfile.devDependencies != null ||
      lockfile.optionalDependencies != null) &&
    !lockfile.importers?.['.']
  ) {
    lockfile.importers = lockfile.importers ?? {};
    lockfile.importers['.'] = {
      dependencies: lockfile.dependencies,
      devDependencies: lockfile.devDependencies,
      optionalDependencies: lockfile.optionalDependencies,
    };
    delete lockfile.dependencies;
    delete lockfile.devDependencies;
    delete lockfile.optionalDependencies;
  }
  for (const importer of Object.values(lockfile.importers ?? {})) {
    for (const depType of [
      'dependencies',
      'optionalDependencies',
      'devDependencies',
    ] as const) {
      for (const [alias, { version }] of Object.entries(
        importer[depType] ?? {}
      )) {
        if (oldIdToNewId[version]) {
          if (oldIdToNewId[version].startsWith(`${alias}@`)) {
            importer[depType]![alias].version = oldIdToNewId[version].substring(
              alias.length + 1
            );
          } else {
            importer[depType]![alias].version = oldIdToNewId[version];
          }
        }
      }
    }
  }
  for (const depType of [
    'dependencies',
    'optionalDependencies',
    'devDependencies',
  ] as const) {
    for (const [alias, { version }] of Object.entries(
      lockfile[depType] ?? {}
    )) {
      if (oldIdToNewId[version]) {
        lockfile[depType]![alias].version = oldIdToNewId[version];
      }
    }
  }
}

// https://github.com/pnpm/pnpm/blob/cca56c0c6c956d036883003092ca1d11bbb700f6/lockfile/lockfile-file/src/lockfileFormatConverters.ts#L289
function convertLockfileV9ToLockfileObject(lockfile: LockfileFileV9): Lockfile {
  const { importers, ...rest } = convertFromLockfileFileMutable(lockfile);

  const packages: PackageSnapshots = {};
  for (const [depPath, pkg] of Object.entries(lockfile.snapshots ?? {})) {
    const pkgId = removePeersSuffix(depPath);
    packages[depPath] = Object.assign(pkg, lockfile.packages?.[pkgId]);
  }
  return {
    ...omit(['snapshots'], rest),
    packages,
    importers: mapValues(importers ?? {}, revertProjectSnapshot),
  };
}

// https://github.com/pnpm/pnpm/blob/cca56c0c6c956d036883003092ca1d11bbb700f6/lockfile/lockfile-file/src/lockfileFormatConverters.ts#L331
function revertProjectSnapshot(
  from: InlineSpecifiersProjectSnapshot
): ProjectSnapshot {
  const specifiers: ResolvedDependencies = {};

  function moveSpecifiers(
    from: InlineSpecifiersResolvedDependencies
  ): ResolvedDependencies {
    const resolvedDependencies: ResolvedDependencies = {};
    for (const [depName, { specifier, version }] of Object.entries(from)) {
      const existingValue = specifiers[depName];
      if (existingValue != null && existingValue !== specifier) {
        throw new Error(
          `Project snapshot lists the same dependency more than once with conflicting versions: ${depName}`
        );
      }

      specifiers[depName] = specifier;
      resolvedDependencies[depName] = version;
    }
    return resolvedDependencies;
  }

  const dependencies =
    from.dependencies == null
      ? from.dependencies
      : moveSpecifiers(from.dependencies);
  const devDependencies =
    from.devDependencies == null
      ? from.devDependencies
      : moveSpecifiers(from.devDependencies);
  const optionalDependencies =
    from.optionalDependencies == null
      ? from.optionalDependencies
      : moveSpecifiers(from.optionalDependencies);

  return {
    ...from,
    specifiers,
    dependencies,
    devDependencies,
    optionalDependencies,
  } as ProjectSnapshot;
}

// https://github.com/pnpm/pnpm/blob/cca56c0c6c956d036883003092ca1d11bbb700f6/lockfile/lockfile-file/src/lockfileFormatConverters.ts#L367
function mapValues<T, U>(
  obj: Record<string, T>,
  mapper: (val: T, key: string) => U
): Record<string, U> {
  const result: Record<string, U> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = mapper(value, key);
  }
  return result;
}

// https://github.com/pnpm/pnpm/blob/cca56c0c6c956d036883003092ca1d11bbb700f6/resolving/git-resolver/src/createGitHostedPkgId.ts#L1
function createGitHostedPkgId({
  repo,
  commit,
  path,
}: {
  repo: string;
  commit: string;
  path?: string;
}): string {
  let id = `${repo.includes('://') ? '' : 'https://'}${repo}#${commit}`;
  if (!id.startsWith('git+')) id = `git+${id}`;
  if (path) {
    id += `&path:${path}`;
  }
  return id;
}

// https://github.com/pnpm/pnpm/blob/af3e5559d377870d4c3d303429b3ed1a4e64fedc/lockfile/lockfile-file/src/write.ts#L106
function normalizeLockfileV6(lockfile: Lockfile, isLockfileV6: boolean) {
  let lockfileToSave!: LockfileFile;
  if (Object.keys(lockfile.importers).length === 1 && lockfile.importers['.']) {
    lockfileToSave = {
      ...lockfile,
      ...lockfile.importers['.'],
    } as any as LockfileFile;
    delete lockfileToSave.importers;
    for (const depType of DEPENDENCIES_FIELDS) {
      if (isEmpty(lockfileToSave[depType])) {
        delete lockfileToSave[depType];
      }
    }
    if (isEmpty(lockfileToSave.packages) || lockfileToSave.packages == null) {
      delete lockfileToSave.packages;
    }
  } else {
    lockfileToSave = {
      ...lockfile,
      importers: mapValues(lockfile.importers, (importer: ProjectSnapshot) => {
        const normalizedImporter: Partial<ProjectSnapshot> = {};
        if (!isEmpty(importer.specifiers ?? {}) || !isLockfileV6) {
          normalizedImporter['specifiers'] = importer.specifiers ?? {};
        }
        if (
          importer.dependenciesMeta != null &&
          !isEmpty(importer.dependenciesMeta)
        ) {
          normalizedImporter['dependenciesMeta'] = importer.dependenciesMeta;
        }
        for (const depType of DEPENDENCIES_FIELDS) {
          if (!isEmpty(importer[depType] ?? {})) {
            normalizedImporter[depType] = importer[depType];
          }
        }
        if (importer.publishDirectory) {
          normalizedImporter.publishDirectory = importer.publishDirectory;
        }
        return normalizedImporter as ProjectSnapshot;
      }),
    } as any as LockfileFile;
    if (isEmpty(lockfileToSave.packages) || lockfileToSave.packages == null) {
      delete lockfileToSave.packages;
    }
  }
  if (lockfileToSave.packages) {
    const newPackages = {};
    for (const [depPath, pkgSnapshot] of Object.entries(
      lockfileToSave.packages
    )) {
      const newDepPath = depPath.replace(/\/$/, '');
      newPackages[newDepPath] = pkgSnapshot;
    }
  }
  if (lockfileToSave.time) {
    lockfileToSave.time = (isLockfileV6 ? pruneTimeInLockfileV6 : pruneTime)(
      lockfileToSave.time,
      lockfile.importers
    );
  }
  if (lockfileToSave.overrides != null && isEmpty(lockfileToSave.overrides)) {
    delete lockfileToSave.overrides;
  }
  if (
    lockfileToSave.patchedDependencies != null &&
    isEmpty(lockfileToSave.patchedDependencies)
  ) {
    delete lockfileToSave.patchedDependencies;
  }
  if (lockfileToSave['neverBuiltDependencies'] != null) {
    if (isEmpty(lockfileToSave['neverBuiltDependencies'])) {
      delete lockfileToSave['neverBuiltDependencies'];
    } else {
      lockfileToSave['neverBuiltDependencies'] =
        lockfileToSave['neverBuiltDependencies'].sort();
    }
  }
  if (lockfileToSave['onlyBuiltDependencies'] != null) {
    lockfileToSave['onlyBuiltDependencies'] =
      lockfileToSave['onlyBuiltDependencies'].sort();
  }
  if (!lockfileToSave.packageExtensionsChecksum) {
    delete lockfileToSave.packageExtensionsChecksum;
  }
  return lockfileToSave;
}

// https://github.com/pnpm/pnpm/blob/af3e5559d377870d4c3d303429b3ed1a4e64fedc/lockfile/lockfile-file/src/write.ts#L173
function pruneTimeInLockfileV6(
  time: Record<string, string>,
  importers: Record<string, ProjectSnapshot>
): Record<string, string> {
  const rootDepPaths = new Set<string>();
  for (const importer of Object.values(importers)) {
    for (const depType of DEPENDENCIES_FIELDS) {
      for (let [depName, ref] of Object.entries(importer[depType] ?? {})) {
        let version: string;
        if (ref['version']) {
          version = ref['version'];
        } else {
          version = ref as string;
        }
        const suffixStart = version.indexOf('(');
        const refWithoutPeerSuffix =
          suffixStart === -1 ? version : version.slice(0, suffixStart);
        const depPath = refToRelative(refWithoutPeerSuffix, depName);
        if (!depPath) continue;
        rootDepPaths.add(depPath);
      }
    }
  }
  return pickBy((prop) => rootDepPaths.has(prop), time);
}

// https://github.com/pnpm/pnpm/blob/af3e5559d377870d4c3d303429b3ed1a4e64fedc/lockfile/lockfile-file/src/write.ts#L191
function refToRelative(reference: string, pkgName: string): string | null {
  if (reference.startsWith('link:')) {
    return null;
  }
  if (reference.startsWith('file:')) {
    return reference;
  }
  if (
    !reference.includes('/') ||
    !reference.replace(/(\([^)]+\))+$/, '').includes('/')
  ) {
    return `/${pkgName}@${reference}`;
  }
  return reference;
}

// https://github.com/pnpm/pnpm/blob/af3e5559d377870d4c3d303429b3ed1a4e64fedc/lockfile/lockfile-file/src/write.ts#L207
function pruneTime(
  time: Record<string, string>,
  importers: Record<string, ProjectSnapshot>
): Record<string, string> {
  const rootDepPaths = new Set<string>();
  for (const importer of Object.values(importers)) {
    for (const depType of DEPENDENCIES_FIELDS) {
      for (let [depName, ref] of Object.entries(importer[depType] ?? {})) {
        let version: string;
        if (ref['version']) {
          version = ref['version'];
        } else {
          version = ref as string;
        }
        const suffixStart = version.indexOf('_');
        const refWithoutPeerSuffix =
          suffixStart === -1 ? version : version.slice(0, suffixStart);
        const depPath = dpRefToRelative(refWithoutPeerSuffix, depName);
        if (!depPath) continue;
        rootDepPaths.add(depPath);
      }
    }
  }
  return pickBy((depPath) => rootDepPaths.has(depPath), time);
}

// https://github.com/pnpm/pnpm/blob/34bc8f48e10dc5a7d54eaa657638f8ccfb406aa4/lockfile/lockfile-file/src/lockfileFormatConverters.ts#L25-L26
interface NormalizeLockfileOpts {
  forceSharedFormat: boolean;
}

// https://github.com/pnpm/pnpm/blob/34bc8f48e10dc5a7d54eaa657638f8ccfb406aa4/lockfile/lockfile-file/src/lockfileFormatConverters.ts#L29
function convertToLockfileFile(
  lockfile: Lockfile,
  opts: NormalizeLockfileOpts
): LockfileFile {
  const packages: Record<string, PackageInfo> = {};
  const snapshots: Record<string, PackageSnapshotV7> = {};
  for (const [depPath, pkg] of Object.entries(lockfile.packages ?? {})) {
    snapshots[depPath] = pick(
      [
        'dependencies',
        'optionalDependencies',
        'transitivePeerDependencies',
        'optional',
        'id',
      ],
      pkg
    );
    const pkgId = removePeersSuffix(depPath);
    if (!packages[pkgId]) {
      packages[pkgId] = pick(
        [
          'resolution',
          'bundledDependencies',
          'cpu',
          'deprecated',
          'engines',
          'hasBin',
          'libc',
          'name',
          'os',
          'peerDependencies',
          'peerDependenciesMeta',
          'version',
        ],
        pkg
      );
    }
  }
  const newLockfile = {
    ...lockfile,
    snapshots,
    packages,
    lockfileVersion: lockfile.lockfileVersion.toString(),
    importers: mapValues(
      lockfile.importers,
      convertProjectSnapshotToInlineSpecifiersFormat
    ),
  };
  return normalizeLockfile(newLockfile, opts);
}

// https://github.com/pnpm/pnpm/blob/34bc8f48e10dc5a7d54eaa657638f8ccfb406aa4/lockfile/lockfile-file/src/lockfileFormatConverters.ts#L68
function normalizeLockfile(
  lockfile: InlineSpecifiersLockfile,
  opts: NormalizeLockfileOpts
): LockfileFile {
  let lockfileToSave!: LockfileFile;
  if (
    !opts.forceSharedFormat &&
    equals(Object.keys(lockfile.importers ?? {}), ['.'])
  ) {
    lockfileToSave = {
      ...lockfile,
      ...lockfile.importers?.['.'],
    };
    delete lockfileToSave.importers;
    for (const depType of DEPENDENCIES_FIELDS) {
      if (isEmpty(lockfileToSave[depType])) {
        delete lockfileToSave[depType];
      }
    }
    if (isEmpty(lockfileToSave.packages) || lockfileToSave.packages == null) {
      delete lockfileToSave.packages;
    }
    if (
      isEmpty((lockfileToSave as LockfileFileV9).snapshots) ||
      (lockfileToSave as LockfileFileV9).snapshots == null
    ) {
      delete (lockfileToSave as LockfileFileV9).snapshots;
    }
  } else {
    lockfileToSave = {
      ...lockfile,
      importers: mapValues(lockfile.importers ?? {}, (importer) => {
        const normalizedImporter: Partial<InlineSpecifiersProjectSnapshot> = {};
        if (
          importer.dependenciesMeta != null &&
          !isEmpty(importer.dependenciesMeta)
        ) {
          normalizedImporter.dependenciesMeta = importer.dependenciesMeta;
        }
        for (const depType of DEPENDENCIES_FIELDS) {
          if (!isEmpty(importer[depType] ?? {})) {
            normalizedImporter[depType] = importer[depType];
          }
        }
        if (importer.publishDirectory) {
          normalizedImporter.publishDirectory = importer.publishDirectory;
        }
        return normalizedImporter as InlineSpecifiersProjectSnapshot;
      }),
    };
    if (isEmpty(lockfileToSave.packages) || lockfileToSave.packages == null) {
      delete lockfileToSave.packages;
    }
    if (
      isEmpty((lockfileToSave as LockfileFileV9).snapshots) ||
      (lockfileToSave as LockfileFileV9).snapshots == null
    ) {
      delete (lockfileToSave as LockfileFileV9).snapshots;
    }
  }
  // This code only handles v9 format
  // if (lockfileToSave.time) {
  //   lockfileToSave.time = pruneTimeInLockfileV6(lockfileToSave.time, lockfile.importers ?? {})
  // }
  if (lockfileToSave.overrides != null && isEmpty(lockfileToSave.overrides)) {
    delete lockfileToSave.overrides;
  }
  if (
    lockfileToSave.patchedDependencies != null &&
    isEmpty(lockfileToSave.patchedDependencies)
  ) {
    delete lockfileToSave.patchedDependencies;
  }
  if (!lockfileToSave.packageExtensionsChecksum) {
    delete lockfileToSave.packageExtensionsChecksum;
  }
  if (!lockfileToSave.ignoredOptionalDependencies?.length) {
    delete lockfileToSave.ignoredOptionalDependencies;
  }
  if (!lockfileToSave.pnpmfileChecksum) {
    delete lockfileToSave.pnpmfileChecksum;
  }
  return lockfileToSave;
}

// https://github.com/pnpm/pnpm/blob/cca56c0c6c956d036883003092ca1d11bbb700f6/lockfile/lockfile-file/src/sortLockfileKeys.ts#L35
type RootKey =
  | keyof LockfileFile
  | 'specifiers'
  | 'neverBuiltDependencies'
  | 'onlyBuiltDependencies';
const ROOT_KEYS: readonly RootKey[] = [
  'lockfileVersion',
  'neverBuiltDependencies',
  'onlyBuiltDependencies',
  'settings',
  'overrides',
  'packageExtensionsChecksum',
  'pnpmfileChecksum',
  'patchedDependencies',
  'specifiers',
  'dependencies',
  'optionalDependencies',
  'devDependencies',
  'dependenciesMeta',
  'importers',
  'packages',
];
const ROOT_KEYS_ORDER = Object.fromEntries(
  ROOT_KEYS.map((key, index) => [key, index])
);

// https://github.com/pnpm/pnpm/blob/af3e5559d377870d4c3d303429b3ed1a4e64fedc/lockfile/lockfile-file/src/sortLockfileKeys.ts#L60
// TODO(meeroslav): pnpm has not a more sophisticated implementation for this function. check if this becomes a bottleneck
function sortLockfileKeys(lockfile: LockfileFile): LockfileFile {
  let sortedLockfile = {} as LockfileFile;
  const sortedKeys = Object.keys(lockfile).sort(
    (a, b) => ROOT_KEYS_ORDER[a] - ROOT_KEYS_ORDER[b]
  );
  for (const key of sortedKeys) {
    sortedLockfile[key] = lockfile[key];
  }
  return sortedLockfile;
}

/*************************************************************************
 * THE FOLLOWING CODE IS COPIED FROM @pnpm/dependency-path for convenience
 *************************************************************************/

// https://github.com/pnpm/pnpm/blob/af3e5559d377870d4c3d303429b3ed1a4e64fedc/packages/dependency-path/src/index.ts#L6
function isAbsolute(dependencyPath) {
  return dependencyPath[0] !== '/';
}

// https://github.com/pnpm/pnpm/blob/cca56c0c6c956d036883003092ca1d11bbb700f6/packages/dependency-path/src/index.ts#L9
function indexOfPeersSuffix(depPath: string): number {
  if (!depPath.endsWith(')')) return -1;
  let open = 1;
  for (let i = depPath.length - 2; i >= 0; i--) {
    if (depPath[i] === '(') {
      open--;
    } else if (depPath[i] === ')') {
      open++;
    } else if (!open) {
      return i + 1;
    }
  }
  return -1;
}

// https://github.com/pnpm/pnpm/blob/cca56c0c6c956d036883003092ca1d11bbb700f6/packages/dependency-path/src/index.ts#L24
interface ParsedDepPath {
  id: string;
  peersSuffix: string;
}

// https://github.com/pnpm/pnpm/blob/cca56c0c6c956d036883003092ca1d11bbb700f6/packages/dependency-path/src/index.ts#L29
function parseDepPath(relDepPath: string): ParsedDepPath {
  const sepIndex = indexOfPeersSuffix(relDepPath);
  if (sepIndex !== -1) {
    return {
      id: relDepPath.substring(0, sepIndex),
      peersSuffix: relDepPath.substring(sepIndex),
    };
  }
  return {
    id: relDepPath,
    peersSuffix: '',
  };
}

// https://github.com/pnpm/pnpm/blob/cca56c0c6c956d036883003092ca1d11bbb700f6/packages/dependency-path/src/index.ts#L43
function removePeersSuffix(relDepPath: string): string {
  const sepIndex = indexOfPeersSuffix(relDepPath);
  if (sepIndex !== -1) {
    return relDepPath.substring(0, sepIndex);
  }
  return relDepPath;
}

// https://github.com/pnpm/pnpm/blob/af3e5559d377870d4c3d303429b3ed1a4e64fedc/packages/dependency-path/src/index.ts#L80
function dpRefToRelative(reference, pkgName) {
  if (reference.startsWith('link:')) {
    return null;
  }
  if (reference.startsWith('file:')) {
    return reference;
  }
  if (
    !reference.includes('/') ||
    (reference.includes('(') &&
      reference.lastIndexOf('/', reference.indexOf('(')) === -1)
  ) {
    return `/${pkgName}/${reference}`;
  }
  return reference;
}

// https://github.com/pnpm/pnpm/blob/af3e5559d377870d4c3d303429b3ed1a4e64fedc/packages/dependency-path/src/index.ts#L96
function dpParse(dependencyPath) {
  // eslint-disable-next-line: strict-type-predicates
  if (typeof dependencyPath !== 'string') {
    throw new TypeError(
      `Expected \`dependencyPath\` to be of type \`string\`, got \`${
        // eslint-disable-next-line: strict-type-predicates
        dependencyPath === null ? 'null' : typeof dependencyPath
      }\``
    );
  }
  const _isAbsolute = isAbsolute(dependencyPath);
  const parts = dependencyPath.split('/');
  if (!_isAbsolute) parts.shift();
  const host = _isAbsolute ? parts.shift() : undefined;
  if (parts.length === 0)
    return {
      host,
      isAbsolute: _isAbsolute,
    };
  const name = parts[0].startsWith('@')
    ? `${parts.shift()}/${parts.shift()}` // eslint-disable-line @typescript-eslint/restrict-template-expressions
    : parts.shift();
  let version = parts.join('/');
  if (version) {
    let peerSepIndex;
    let peersSuffix;
    if (version.includes('(') && version.endsWith(')')) {
      peerSepIndex = version.indexOf('(');
      if (peerSepIndex !== -1) {
        peersSuffix = version.substring(peerSepIndex);
        version = version.substring(0, peerSepIndex);
      }
    } else {
      peerSepIndex = version.indexOf('_');
      if (peerSepIndex !== -1) {
        peersSuffix = version.substring(peerSepIndex + 1);
        version = version.substring(0, peerSepIndex);
      }
    }
    if (valid(version)) {
      return {
        host,
        isAbsolute: _isAbsolute,
        name,
        peersSuffix,
        version,
      };
    }
  }
  if (!_isAbsolute)
    throw new Error(`${dependencyPath} is an invalid relative dependency path`);
  return {
    host,
    isAbsolute: _isAbsolute,
  };
}

/********************************************************************************
 * THE FOLLOWING CODE IS COPIED AND SIMPLIFIED FROM @pnpm/ramda for convenience
 *******************************************************************************/

// https://github.com/pnpm/ramda/blob/50c6b57110b2f3631ed8633141f12012b7768d85/source/pick.js#L22
function pick<T extends Record<string, any>, N extends keyof T>(
  names: Array<N>,
  obj: T
): Pick<T, N> {
  var result: Partial<T> = {};
  var idx = 0;
  while (idx < names.length) {
    if (names[idx] in obj) {
      result[names[idx]] = obj[names[idx]];
    }
    idx += 1;
  }
  return result as Pick<T, N>;
}

// https://github.com/pnpm/ramda/blob/50c6b57110b2f3631ed8633141f12012b7768d85/source/pickBy.js#L24
function pickBy(test: (prop: string) => boolean, obj: Record<string, string>) {
  let result = {};

  for (const prop in obj) {
    if (test(obj[prop])) {
      result[prop] = obj[prop];
    }
  }

  return result;
}

// https://github.com/pnpm/ramda/blob/50c6b57110b2f3631ed8633141f12012b7768d85/source/isEmpty.js#L28
function isEmpty(obj: object) {
  return obj != null && Object.keys(obj).length === 0;
}

// https://github.com/pnpm/ramda/blob/50c6b57110b2f3631ed8633141f12012b7768d85/source/omit.js#L19
function omit<T extends Record<string, any>, N extends string[]>(
  names: N,
  obj: T
): Pick<T, Exclude<keyof T, N>> {
  let result: Partial<T> = {};
  let index = {};
  let idx = 0;
  const len = names.length;

  while (idx < len) {
    index[names[idx]] = 1;
    idx += 1;
  }

  for (var prop in obj) {
    if (!index.hasOwnProperty(prop)) {
      result[prop] = obj[prop];
    }
  }
  return result as Pick<T, Exclude<keyof T, N>>;
}

// This is a simplified internal implementation of the `equals` to replace complex function from Ramda
function equals<T extends unknown>(a: T, b: T) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  if (typeof a === 'object' && typeof b === 'object') {
    return hashObject(a) === hashObject(b);
  }
  return a === b;
}
