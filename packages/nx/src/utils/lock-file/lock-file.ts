import { readFileSync, writeFileSync } from 'fs-extra';
import { stringifySyml as stringifyYarn } from '@yarnpkg/parsers';
import { stringify as stringifyYarn1 } from '@yarnpkg/lockfile';
import {
  detectPackageManager,
  getPackageManagerVersion,
  PackageManager,
} from '../package-manager';
import { gte } from 'semver';
import { parseLockFile as parseYarn } from './yarn';
import {
  parseLockFile as parseNpm,
  stringifyLockFile as stringifyNpm,
} from './npm';
import { parseLockFile as parsePnpm } from './pnpm';
import { LockFileData } from './lock-file-type';
import { join } from 'path';

export function parseLockFile(
  packageManager: PackageManager = detectPackageManager(),
  workingDirectory: string = ''
): LockFileData {
  if (packageManager === 'yarn') {
    const file = readFileSync(join(workingDirectory, 'yarn.lock'), 'utf8');
    const yarnVersion = getPackageManagerVersion('yarn');
    return parseYarn(file, gte(yarnVersion, '2.0.0'));
  }
  if (packageManager === 'pnpm') {
    const file = readFileSync(join(workingDirectory, 'pnpm-lock.yaml'), 'utf8');
    return parsePnpm(file);
  }
  if (packageManager === 'npm') {
    const file = readFileSync(
      join(workingDirectory, 'package-lock.json'),
      'utf8'
    );
    return parseNpm(file);
  }
}

export function writeLockFile(
  lockFile: LockFileData,
  packageManager: PackageManager = detectPackageManager(),
  workingDirectory: string = ''
): void {
  //   if (packageManager === 'yarn') {
  //     const yarnVersion = getPackageManagerVersion('yarn');
  //     const useBerry = gte(yarnVersion, '2.0.0');
  //     const content = useBerry
  //       ? stringifyYarn(lockFile)
  //       : stringifyYarn1(lockFile);
  //     writeFileSync('yarn.lock', content);
  //   }
  //   if (packageManager === 'pnpm') {
  //     return await writePnpm('.', lockFile as PnpmLockFile);
  //   }
  if (packageManager === 'npm') {
    const content = stringifyNpm(lockFile);
    writeFileSync(join(workingDirectory, 'package-lock.json'), content + '\n');
  }
}
