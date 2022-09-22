import { readFileSync, writeFileSync } from 'fs-extra';
import { detectPackageManager, PackageManager } from '../package-manager';
import {
  parseYarnLockFile,
  pruneYarnLockFile,
  stringifyYarnLockFile,
} from './yarn';
import {
  parseNpmLockFile,
  pruneNpmLockFile,
  stringifyNpmLockFile,
} from './npm';
import {
  parsePnpmLockFile,
  prunePnpmLockFile,
  stringifyPnpmLockFile,
} from './pnpm';
import { LockFileData } from './lock-file-type';
import { hashLockFile } from './utils';

export function lockFileHash(
  packageManager: PackageManager = detectPackageManager()
): string {
  let file: string;
  if (packageManager === 'yarn') {
    file = readFileSync('yarn.lock', 'utf8');
  }
  if (packageManager === 'pnpm') {
    file = readFileSync('pnpm-lock.yaml', 'utf8');
  }
  if (packageManager === 'npm') {
    file = readFileSync('package-lock.json', 'utf8');
  }
  if (file) {
    return hashLockFile(file);
  } else {
    throw Error(
      `Unknown package manager ${packageManager} or lock file missing`
    );
  }
}

/**
 * Parses lock file and maps dependencies and metadata to {@link LockFileData}
 */
export function parseLockFile(
  packageManager: PackageManager = detectPackageManager()
): LockFileData {
  if (packageManager === 'yarn') {
    const file = readFileSync('yarn.lock', 'utf8');
    return parseYarnLockFile(file);
  }
  if (packageManager === 'pnpm') {
    const file = readFileSync('pnpm-lock.yaml', 'utf8');
    return parsePnpmLockFile(file);
  }
  if (packageManager === 'npm') {
    const file = readFileSync('package-lock.json', 'utf8');
    return parseNpmLockFile(file);
  }
  throw Error(`Unknown package manager: ${packageManager}`);
}

/**
 * Stringifies {@link LockFileData} content and writes it to lock file
 */
export function writeLockFile(
  lockFile: LockFileData,
  packageManager: PackageManager = detectPackageManager()
): void {
  if (packageManager === 'yarn') {
    const content = stringifyYarnLockFile(lockFile);
    writeFileSync('yarn.lock', content);
    return;
  }
  if (packageManager === 'pnpm') {
    const content = stringifyPnpmLockFile(lockFile);
    writeFileSync('pnpm-lock.yaml', content);
    return;
  }
  if (packageManager === 'npm') {
    const content = stringifyNpmLockFile(lockFile);
    writeFileSync('package-lock.json', content);
    return;
  }
  throw Error(`Unknown package manager: ${packageManager}`);
}

/**
 * Prunes {@link LockFileData} based on minimal necessary set of packages
 * Returns new {@link LockFileData}
 */
export function pruneLockFile(
  lockFile: LockFileData,
  packages: string[],
  packageManager: PackageManager = detectPackageManager()
): LockFileData {
  if (packageManager === 'yarn') {
    return pruneYarnLockFile(lockFile, packages);
  }
  if (packageManager === 'pnpm') {
    return prunePnpmLockFile(lockFile, packages);
  }
  if (packageManager === 'npm') {
    return pruneNpmLockFile(lockFile, packages);
  }
  throw Error(`Unknown package manager: ${packageManager}`);
}
