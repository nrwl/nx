import { readFileSync, writeFileSync } from 'fs-extra';
import {
  parseSyml as parseYarn,
  stringifySyml as stringifyYarn,
} from '@yarnpkg/parsers';
import {
  readWantedLockfile as readPnpm,
  writeWantedLockfile as writePnpm,
} from '@pnpm/lockfile-file';
import { stringify as stringifyYarn1 } from '@yarnpkg/lockfile';
import {
  detectPackageManager,
  getPackageManagerVersion,
  PackageManager,
} from './package-manager';
import { gte } from 'semver';
import { LockFile, PnpmLockFile } from './lock-files/models';

export async function parseLockFile(
  packageManager: PackageManager = detectPackageManager()
): Promise<LockFile> {
  if (packageManager === 'yarn') {
    const file = readFileSync('yarn.lock', 'utf8');
    return parseYarn(file);
  }
  if (packageManager === 'pnpm') {
    return (await readPnpm('.', { ignoreIncompatible: false })) as any;
  }
  if (packageManager === 'npm') {
    const file = readFileSync('package-lock.json', 'utf8');
    return JSON.parse(file);
  }
}

export async function writeLockFile(
  lockFile: LockFile,
  packageManager: PackageManager = detectPackageManager()
) {
  if (packageManager === 'yarn') {
    const yarnVersion = getPackageManagerVersion('yarn');
    const useBerry = gte(yarnVersion, '2.0.0');

    const content = useBerry
      ? stringifyYarn(lockFile)
      : stringifyYarn1(lockFile);

    writeFileSync('yarn.lock', content);
  }
  if (packageManager === 'pnpm') {
    return await writePnpm('.', lockFile as PnpmLockFile);
  }
  if (packageManager === 'npm') {
    const content = JSON.stringify(lockFile, null, 2);
    writeFileSync('package-lock.json', content + '\n');
  }
}
