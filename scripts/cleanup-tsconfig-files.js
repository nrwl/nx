#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * Remove TypeScript configuration and build info files from the dist directory
 * Usage: node scripts/cleanup-tsconfig-files.js <outputPath>
 */

function cleanupTsConfigFiles(outputPath) {
  if (!outputPath) {
    console.error('Error: Output path is required');
    console.error('Usage: node scripts/cleanup-tsconfig-files.js <outputPath>');
    process.exit(1);
  }

  if (!fs.existsSync(outputPath)) {
    console.log(`Output path does not exist: ${outputPath}`);
    return;
  }

  // Find all tsconfig and tsbuildinfo files in the output directory
  const tsConfigPattern = path
    .join(outputPath, '**/tsconfig*.json')
    .replace(/\\/g, '/');
  const tsBuildInfoPattern = path
    .join(outputPath, '**/*.tsbuildinfo')
    .replace(/\\/g, '/');

  const tsConfigFiles = glob.sync(tsConfigPattern);
  const tsBuildInfoFiles = glob.sync(tsBuildInfoPattern);

  const allFiles = [...tsConfigFiles, ...tsBuildInfoFiles];

  if (allFiles.length === 0) {
    console.log(
      `No TypeScript config or build info files found in ${outputPath}`
    );
    return;
  }

  console.log(
    `Removing ${allFiles.length} TypeScript config/build file(s) from ${outputPath}:`
  );

  for (const file of allFiles) {
    try {
      fs.unlinkSync(file);
      console.log(`  ✓ Removed: ${path.relative(outputPath, file)}`);
    } catch (error) {
      console.error(`  ✗ Failed to remove ${file}: ${error.message}`);
    }
  }
}

// If run directly (not required as module)
if (require.main === module) {
  const outputPath = process.argv[2];
  cleanupTsConfigFiles(outputPath);
}

module.exports = { cleanupTsConfigFiles };
