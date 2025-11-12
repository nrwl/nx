#!/usr/bin/env node

/**
 * Updates metadata JSON files (generators.json, executors.json, migrations.json)
 * to point to ./dist/src/ instead of ./src/
 * Part of Phase 3.5 of the local dist migration
 */

const { readdirSync, readFileSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');

const PACKAGES_DIR = join(__dirname, '..', 'packages');
const METADATA_FILES = ['generators.json', 'executors.json', 'migrations.json'];

function updateMetadataFile(filePath) {
  console.log(`Processing: ${filePath}`);

  const content = readFileSync(filePath, 'utf-8');
  const json = JSON.parse(content);

  let modified = false;

  function updatePaths(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Update factory, implementation, batchImplementation, and schema paths
        if (
          (key === 'factory' ||
           key === 'implementation' ||
           key === 'batchImplementation' ||
           key === 'schema') &&
          value.startsWith('./src/')
        ) {
          obj[key] = value.replace('./src/', './dist/src/');
          modified = true;
        }
      } else if (typeof value === 'object') {
        updatePaths(value);
      }
    }
  }

  updatePaths(json);

  if (modified) {
    // Write with proper formatting (2 spaces, trailing newline)
    writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf-8');
    console.log(`  ✓ Updated paths in ${filePath}`);
    return true;
  } else {
    console.log(`  - No changes needed for ${filePath}`);
    return false;
  }
}

function processPackage(packageName) {
  const packageDir = join(PACKAGES_DIR, packageName);
  let updatedCount = 0;

  for (const metadataFile of METADATA_FILES) {
    const filePath = join(packageDir, metadataFile);
    if (existsSync(filePath)) {
      if (updateMetadataFile(filePath)) {
        updatedCount++;
      }
    }
  }

  return updatedCount;
}

function main() {
  console.log('🔄 Updating metadata JSON paths from ./src/ to ./dist/src/\n');

  const packages = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  let totalUpdated = 0;
  let packagesWithUpdates = 0;

  for (const packageName of packages) {
    const updated = processPackage(packageName);
    if (updated > 0) {
      totalUpdated += updated;
      packagesWithUpdates++;
    }
  }

  console.log(`\n✅ Complete!`);
  console.log(`   ${totalUpdated} files updated across ${packagesWithUpdates} packages`);
}

main();
