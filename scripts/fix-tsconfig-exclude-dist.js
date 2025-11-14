#!/usr/bin/env node

/**
 * Adds "dist" to the exclude array in all tsconfig.lib.json files
 * Prevents TypeScript from trying to compile files in the dist directory
 */

const { readdirSync, readFileSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');

const PACKAGES_DIR = join(__dirname, '..', 'packages');

function fixTsconfig(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const json = JSON.parse(content);

  if (!json.exclude) {
    json.exclude = [];
  }

  if (!json.exclude.includes('dist')) {
    json.exclude.push('dist');
    writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf-8');
    return true;
  }

  return false;
}

function main() {
  console.log('🔧 Adding "dist" to tsconfig.lib.json exclude arrays\n');

  const packages = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  let updated = 0;

  for (const packageName of packages) {
    const tsconfigPath = join(PACKAGES_DIR, packageName, 'tsconfig.lib.json');
    if (existsSync(tsconfigPath)) {
      if (fixTsconfig(tsconfigPath)) {
        console.log(`  ✓ ${packageName}`);
        updated++;
      }
    }
  }

  console.log(`\n✅ Updated ${updated} tsconfig.lib.json files`);
}

main();
