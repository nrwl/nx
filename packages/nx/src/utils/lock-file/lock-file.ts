import { readFileSync, writeFileSync } from 'fs-extra';
import { detectPackageManager, PackageManager } from '../package-manager';
import { parseYarnLockFile, stringifyYarnLockFile } from './yarn';
import { parseNpmLockFile, stringifyNpmLockFile } from './npm';
import { parsePnpmLockFile, stringifyPnpmLockFile } from './pnpm';
import { LockFileData } from './lock-file-type';

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
