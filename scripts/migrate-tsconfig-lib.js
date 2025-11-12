#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * Migrate all tsconfig.lib.json files to use local dist folders
 */

const tsconfigFiles = glob.sync('packages/*/tsconfig.lib.json');

console.log(`Found ${tsconfigFiles.length} tsconfig.lib.json files to update`);

for (const file of tsconfigFiles) {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    const config = JSON.parse(content);

    if (!config.compilerOptions) {
      console.log(`⚠️  Skipping ${file} - no compilerOptions found`);
      continue;
    }

    let modified = false;

    // Update outDir
    if (
      config.compilerOptions.outDir &&
      config.compilerOptions.outDir.includes('../../dist/packages/')
    ) {
      const oldOutDir = config.compilerOptions.outDir;
      config.compilerOptions.outDir = './dist';
      console.log(`✓ ${file}: outDir ${oldOutDir} -> ./dist`);
      modified = true;
    }

    // Update tsBuildInfoFile
    if (
      config.compilerOptions.tsBuildInfoFile &&
      config.compilerOptions.tsBuildInfoFile.includes('../../dist/packages/')
    ) {
      const oldTsBuildInfo = config.compilerOptions.tsBuildInfoFile;
      config.compilerOptions.tsBuildInfoFile = './dist/tsconfig.tsbuildinfo';
      console.log(
        `✓ ${file}: tsBuildInfoFile ${oldTsBuildInfo} -> ./dist/tsconfig.tsbuildinfo`
      );
      modified = true;
    }

    // Update module to nodenext (if it's currently commonjs)
    if (config.compilerOptions.module === 'commonjs') {
      config.compilerOptions.module = 'nodenext';
      console.log(`✓ ${file}: module commonjs -> nodenext`);
      modified = true;
    }

    // Add moduleResolution: nodenext if not present or not already nodenext
    if (
      !config.compilerOptions.moduleResolution ||
      config.compilerOptions.moduleResolution !== 'nodenext'
    ) {
      config.compilerOptions.moduleResolution = 'nodenext';
      console.log(`✓ ${file}: moduleResolution -> nodenext`);
      modified = true;
    }

    if (modified) {
      // Write back with proper formatting
      fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
      console.log(`✅ Updated ${file}\n`);
    } else {
      console.log(`⏭️  Skipped ${file} - no changes needed\n`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${file}: ${error.message}`);
  }
}

console.log('Migration complete!');
