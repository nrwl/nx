#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * Remove TypeScript configuration and build info files from the dist directory
 */

function cleanupTsConfigFiles() {
  const outputPath = 'dist/packages';

  if (!fs.existsSync(outputPath)) {
    console.log(`Output path does not exist: ${outputPath}`);
    return;
  }

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
      console.log(`Removed: ${path.relative(outputPath, file)}`);
    } catch (error) {
      console.error(`Failed to remove ${file}: ${error.message}`);
    }
  }
}

cleanupTsConfigFiles();
