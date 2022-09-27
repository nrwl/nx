import { readdirSync, readFileSync, writeFileSync } from 'fs';
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
import { workspaceRoot } from '../workspace-root';
import { join } from 'path';

export function lockFileHash(
  packageManager: PackageManager = detectPackageManager(workspaceRoot)
): string {
  let file: string;
  if (packageManager === 'yarn') {
    file = readFileSync(join(workspaceRoot, 'yarn.lock'), 'utf8');
  }
  if (packageManager === 'pnpm') {
    file = readFileSync(join(workspaceRoot, 'pnpm-lock.yaml'), 'utf8');
  }
  if (packageManager === 'npm') {
    file = readFileSync(join(workspaceRoot, 'package-lock.json'), 'utf8');
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
  packageManager: PackageManager = detectPackageManager(workspaceRoot)
): LockFileData {
  if (packageManager === 'yarn') {
    const file = readFileSync(join(workspaceRoot, 'yarn.lock'), 'utf8');
    return parseYarnLockFile(file);
  }
  if (packageManager === 'pnpm') {
    const file = readFileSync(join(workspaceRoot, 'pnpm-lock.yaml'), 'utf8');
    return parsePnpmLockFile(file);
  }
  if (packageManager === 'npm') {
    const file = readFileSync(join(workspaceRoot, 'package-lock.json'), 'utf8');
    return parseNpmLockFile(file);
  }
  throw Error(`Unknown package manager: ${packageManager}`);
}

/**
 * Stringifies {@link LockFileData} content and writes it to lock file
 */
export function writeLockFile(
  lockFile: LockFileData,
  packageManager: PackageManager = detectPackageManager(workspaceRoot)
): void {
  if (packageManager === 'yarn') {
    const content = stringifyYarnLockFile(lockFile);
    writeFileSync(join(workspaceRoot, 'yarn.lock'), content);
    return;
  }
  if (packageManager === 'pnpm') {
    const content = stringifyPnpmLockFile(lockFile);
    writeFileSync(join(workspaceRoot, 'pnpm-lock.yaml'), content);
    return;
  }
  if (packageManager === 'npm') {
    const content = stringifyNpmLockFile(lockFile);
    writeFileSync(join(workspaceRoot, 'package-lock.json'), content);
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
  packageManager: PackageManager = detectPackageManager(workspaceRoot)
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
