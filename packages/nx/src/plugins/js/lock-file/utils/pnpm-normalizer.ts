/**
 * This file contains the logic to convert pnpm lockfile to a standard format.
 * It will convert inline specifiers to the separate specifiers format and ensure importers are present.
 */

import type {
  Lockfile,
  ProjectSnapshot,
  ResolvedDependencies,
} from '@pnpm/lockfile-types';
import { dump, load } from '@zkochan/js-yaml';
import { existsSync, readFileSync } from 'fs';
import { workspaceRoot } from '../../../../utils/workspace-root';

const LOCKFILE_YAML_FORMAT = {
  blankLines: true,
  lineWidth: 1000,
  noCompatMode: true,
  noRefs: true,
  sortKeys: false,
};

export function stringifyToPnpmYaml(lockfile: Lockfile): string {
  return dump(lockfile, LOCKFILE_YAML_FORMAT);
}

export function parseAndNormalizePnpmLockfile(content: string): Lockfile {
  const lockFileData = load(content);
  return revertFromInlineSpecifiersFormatIfNecessary(
    convertFromLockfileFileMutable(lockFileData)
  );
}

export function loadPnpmHoistedDepsDefinition() {
  const fullPath = `${workspaceRoot}/node_modules/.modules.yaml`;

  if (existsSync(fullPath)) {
    const content = readFileSync(fullPath, 'utf-8');
    return load(content)?.hoistedDependencies ?? {};
  } else {
    throw new Error(`Could not find ".modules.yaml" at "${fullPath}"`);
  }
}

/**
 * THE FOLLOWING CODE IS COPIED FROM @pnpm/lockfile-file for convenience
 */

function isMutableLockfile(
  lockfileFile:
    | (Omit<Lockfile, 'importers'> &
        Partial<ProjectSnapshot> &
        Partial<Pick<Lockfile, 'importers'>>)
    | InlineSpecifiersLockfile
    | Lockfile
): lockfileFile is Omit<Lockfile, 'importers'> &
  Partial<ProjectSnapshot> &
  Partial<Pick<Lockfile, 'importers'>> {
  return typeof lockfileFile['importers'] === 'undefined';
}

/**
 * Reverts changes from the "forceSharedFormat" write option if necessary.
 */
function convertFromLockfileFileMutable(
  lockfileFile:
    | (Omit<Lockfile, 'importers'> &
        Partial<ProjectSnapshot> &
        Partial<Pick<Lockfile, 'importers'>>)
    | InlineSpecifiersLockfile
    | Lockfile
): InlineSpecifiersLockfile | Lockfile {
  if (isMutableLockfile(lockfileFile)) {
    lockfileFile.importers = {
      '.': {
        specifiers: lockfileFile['specifiers'] ?? {},
        ...(lockfileFile['dependenciesMeta'] && {
          dependenciesMeta: lockfileFile['dependenciesMeta'],
        }),
        ...(lockfileFile['publishDirectory'] && {
          publishDirectory: lockfileFile['publishDirectory'],
        }),
      },
    };
    delete lockfileFile.specifiers;
    for (const depType of DEPENDENCIES_FIELDS) {
      if (lockfileFile[depType] != null) {
        lockfileFile.importers['.'][depType] = lockfileFile[depType];
        delete lockfileFile[depType];
      }
    }
    return lockfileFile as Lockfile;
  } else {
    return lockfileFile;
  }
}

interface InlineSpecifiersLockfile
  extends Omit<Lockfile, 'lockfileVersion' | 'importers'> {
  lockfileVersion: string;
  importers: Record<string, InlineSpecifiersProjectSnapshot>;
}

interface InlineSpecifiersProjectSnapshot {
  dependencies?: InlineSpecifiersResolvedDependencies;
  devDependencies?: InlineSpecifiersResolvedDependencies;
  optionalDependencies?: InlineSpecifiersResolvedDependencies;
  dependenciesMeta?: ProjectSnapshot['dependenciesMeta'];
}

interface InlineSpecifiersResolvedDependencies {
  [depName: string]: SpecifierAndResolution;
}

interface SpecifierAndResolution {
  specifier: string;
  version: string;
}

const INLINE_SPECIFIERS_FORMAT_LOCKFILE_VERSION_SUFFIX = '-inlineSpecifiers';

function isInlineSpecifierLockfile(
  lockfile: InlineSpecifiersLockfile | Lockfile
): lockfile is InlineSpecifiersLockfile {
  return (
    typeof lockfile.lockfileVersion === 'string' &&
    lockfile.lockfileVersion.endsWith(
      INLINE_SPECIFIERS_FORMAT_LOCKFILE_VERSION_SUFFIX
    )
  );
}

function revertFromInlineSpecifiersFormatIfNecessary(
  lockFile: InlineSpecifiersLockfile | Lockfile
): Lockfile {
  if (isInlineSpecifierLockfile(lockFile)) {
    const { lockfileVersion, importers, ...rest } = lockFile;

    const originalVersionStr = lockfileVersion.replace(
      INLINE_SPECIFIERS_FORMAT_LOCKFILE_VERSION_SUFFIX,
      ''
    );
    const originalVersion = Number(originalVersionStr);
    if (isNaN(originalVersion)) {
      throw new Error(
        `Unable to revert lockfile from inline specifiers format. Invalid version parsed: ${originalVersionStr}`
      );
    }

    const mappedImporters: Record<string, ProjectSnapshot> = {};
    Object.entries(importers).forEach(([key, value]) => {
      mappedImporters[key] = revertProjectSnapshot(value);
    });

    return {
      ...rest,
      lockfileVersion: originalVersion,
      importers: mappedImporters,
    };
  }
  return lockFile;
}

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

  const dependencies: ResolvedDependencies = from.dependencies
    ? moveSpecifiers(from.dependencies)
    : null;
  const devDependencies: ResolvedDependencies = from.devDependencies
    ? moveSpecifiers(from.devDependencies)
    : null;
  const optionalDependencies: ResolvedDependencies = from.optionalDependencies
    ? moveSpecifiers(from.optionalDependencies)
    : null;

  return {
    ...from,
    specifiers,
    dependencies,
    devDependencies,
    optionalDependencies,
  };
}

export const DEPENDENCIES_FIELDS = [
  'optionalDependencies',
  'dependencies',
  'devDependencies',
];
