import { readFileSync, writeFileSync } from 'fs-extra';
import { join } from 'path';
import { gte } from 'semver';
import {
  detectPackageManager,
  getPackageManagerVersion,
  PackageManager,
} from '../package-manager';
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
  packageManager: PackageManager = detectPackageManager(),
  root: string = ''
): LockFileData {
  if (packageManager === 'yarn') {
    const file = readFileSync(join(root, 'yarn.lock'), 'utf8');
    return parseYarn(file);
  }
  if (packageManager === 'pnpm') {
    const file = readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8');
    return parsePnpm(file);
  }
  if (packageManager === 'npm') {
    const file = readFileSync(join(root, 'package-lock.json'), 'utf8');
    return parseNpm(file);
  }
  throw Error(`Unknown package manager: ${packageManager}`);
}

export function writeLockFile(
  lockFile: LockFileData,
  packageManager: PackageManager = detectPackageManager(),
  root: string = ''
): void {
  if (packageManager === 'yarn') {
    const yarnVersion = getPackageManagerVersion('yarn');
    const useBerry = gte(yarnVersion, '2.0.0');
    const content = stringifyYarn(lockFile, useBerry);
    writeFileSync(join(root, 'yarn.lock'), content);
    return;
  }
  if (packageManager === 'pnpm') {
    const content = stringifyPnpm(lockFile);
    writeFileSync(join(root, 'pnpm-lock.yaml'), content);
    return;
  }
  if (packageManager === 'npm') {
    const content = stringifyNpm(lockFile);
    writeFileSync(join(root, 'package-lock.json'), content + '\n');
    return;
  }
  throw Error(`Unknown package manager: ${packageManager}`);
}
