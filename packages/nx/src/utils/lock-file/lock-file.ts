import { readFileSync, writeFileSync } from 'fs-extra';
import {
  detectPackageManager,
  getPackageManagerVersion,
  PackageManager,
} from '../package-manager';
import { gte } from 'semver';
import {
  parseLockFile as parseYarn,
  stringifyLockFile as stringifyYarn,
} from './yarn';
import {
  parseLockFile as parseNpm,
  stringifyLockFile as stringifyNpm,
} from './npm';
import { parseLockFile as parsePnpm } from './pnpm';
import { LockFileData } from './lock-file-type';
import { join } from 'path';

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
  //   if (packageManager === 'pnpm') {
  //     return await writePnpm('.', lockFile as PnpmLockFile);
  //   }
  if (packageManager === 'npm') {
    const content = stringifyNpm(lockFile);
    writeFileSync(join(root, 'package-lock.json'), content + '\n');
    return;
  }
  throw Error(`Unknown package manager: ${packageManager}`);
}
