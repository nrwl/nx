import { readFileSync, writeFileSync } from 'fs-extra';
import { detectPackageManager, PackageManager } from '../package-manager';
import {
  parseLockFile as parseYarn,
  stringifyLockFile as stringifyYarn,
} from './yarn';
import {
  parseLockFile as parseNpm,
  stringifyLockFile as stringifyNpm,
} from './npm';
import {
  parseLockFile as parsePnpm,
  stringifyLockFile as stringifyPnpm,
} from './pnpm';
import { LockFileData } from './lock-file-type';

export function parseLockFile(
  packageManager: PackageManager = detectPackageManager()
): LockFileData {
  if (packageManager === 'yarn') {
    const file = readFileSync('yarn.lock', 'utf8');
    return parseYarn(file);
  }
  if (packageManager === 'pnpm') {
    const file = readFileSync('pnpm-lock.yaml', 'utf8');
    return parsePnpm(file);
  }
  if (packageManager === 'npm') {
    const file = readFileSync('package-lock.json', 'utf8');
    return parseNpm(file);
  }
  throw Error(`Unknown package manager: ${packageManager}`);
}

export function writeLockFile(
  lockFile: LockFileData,
  packageManager: PackageManager = detectPackageManager()
): void {
  if (packageManager === 'yarn') {
    const content = stringifyYarn(lockFile);
    writeFileSync('yarn.lock', content);
    return;
  }
  if (packageManager === 'pnpm') {
    const content = stringifyPnpm(lockFile);
    writeFileSync('pnpm-lock.yaml', content);
    return;
  }
  if (packageManager === 'npm') {
    const content = stringifyNpm(lockFile);
    writeFileSync('package-lock.json', content);
    return;
  }
  throw Error(`Unknown package manager: ${packageManager}`);
}
