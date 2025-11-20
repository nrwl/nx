#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * Remove TypeScript configuration and build info files from the dist directory
 */

function cleanupJsonInDist() {
  const pathToDist = process.argv[2];
  if (!pathToDist) {
    // silent exit
    return;
  }
  const resolvedPathToDist = path.join(process.cwd(), pathToDist);
  if (!fs.existsSync(resolvedPathToDist)) {
    // silent exit
    return;
  }

  const jsonFilesToRemove = [
    '.eslintrc.json',
    'package.json',
    'executors.json',
    'generators.json',
    'migrations.json',
  ];
  for (const file of jsonFilesToRemove) {
    const fullFilePath = path.join(resolvedPathToDist, file);
    if (!fs.existsSync(fullFilePath)) {
      // skip to next
      continue;
    }
    fs.unlinkSync(fullFilePath);
  }

  console.log('Cleaned up unnecessary json files in dist');
}

cleanupJsonInDist();
