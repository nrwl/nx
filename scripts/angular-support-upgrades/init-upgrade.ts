#!/usr/bin/env node

/**
 * USAGE:
 *
 * Run the following command from the root of the workspace.
 * Replace the versions with the correct target versions
 *
 * pnpm ts-node scripts/angular-support-upgrades/init-upgrade.ts --angularVersion=next --targetNxVersion=15.5.0 --targetNxMigrationVersion=15.5.0-beta.0
 *
 */
import { execSync } from 'child_process';
import { buildMigrations } from './build-migrations';
import { fetchVersionsFromRegistry } from './fetch-versions-from-registry';
import { updatePackageJsonForAngular } from './update-package-jsons';
import { updateVersionUtils } from './update-version-utils';

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const argv = yargs(hideBin(process.argv)).argv;

if (
  !argv.angularVersion &&
  !argv.targetNxVersion &&
  !argv.targetNxMigrationVersion
) {
  throw new Error(
    'You need to provide --angularVersion=(latest|next) and --targetNxVersion=versionString and --targetNxMigrationVersion=versionString'
  );
}

async function run() {
  const packageVersionMap = await fetchVersionsFromRegistry(
    argv.angularVersion
  );
  await updatePackageJsonForAngular(packageVersionMap);
  await buildMigrations(
    packageVersionMap,
    argv.targetNxVersion,
    argv.targetNxMigrationVersion
  );
  updateVersionUtils(packageVersionMap);

  console.log('⏳ - Formatting files...');
  execSync('pnpm nx format', { stdio: 'inherit', encoding: 'utf8' });
  console.log('✅ - Finished formatting files');

  console.log('⏳ - Installing packages...');
  execSync('pnpm install', { stdio: 'inherit', encoding: 'utf8' });
  console.log('✅ - Finished creating migrations!');
}

run();
