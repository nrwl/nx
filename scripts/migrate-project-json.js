#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * Update all project.json files to use local dist paths
 */

const projectFiles = glob.sync('packages/*/project.json');

console.log(`Found ${projectFiles.length} project.json files to update`);

for (const file of projectFiles) {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    let modified = false;
    let newContent = content;

    // Extract package name from file path
    const packageName = file.split('/')[1];

    // Pattern 1: Replace {workspaceRoot}/dist/packages/{name} with {projectRoot}/dist
    const pattern1 = new RegExp(
      `\\{workspaceRoot\\}/dist/packages/${packageName}`,
      'g'
    );
    if (pattern1.test(newContent)) {
      newContent = newContent.replace(pattern1, '{projectRoot}/dist');
      console.log(
        `✓ ${file}: Replaced {workspaceRoot}/dist/packages/${packageName} with {projectRoot}/dist`
      );
      modified = true;
    }

    // Pattern 2: Replace "dist/packages/{name}" in commands with "packages/{name}/dist"
    const pattern2 = new RegExp(`dist/packages/${packageName}`, 'g');
    if (pattern2.test(newContent)) {
      newContent = newContent.replace(pattern2, `packages/${packageName}/dist`);
      console.log(
        `✓ ${file}: Replaced dist/packages/${packageName} with packages/${packageName}/dist`
      );
      modified = true;
    }

    // Pattern 3: Special case for copy command in nx package
    if (packageName === 'nx') {
      // Handle: dist/packages/nx/native-packages/* dist/packages
      if (
        newContent.includes('dist/packages/nx/native-packages/* dist/packages')
      ) {
        newContent = newContent.replace(
          'dist/packages/nx/native-packages/* dist/packages',
          'packages/nx/dist/native-packages/* dist/packages'
        );
        console.log(`✓ ${file}: Updated native-packages copy command`);
        modified = true;
      }

      // Handle: --package-json-path dist/packages/nx/package.json
      if (
        newContent.includes('--package-json-path dist/packages/nx/package.json')
      ) {
        newContent = newContent.replace(
          '--package-json-path dist/packages/nx/package.json',
          '--package-json-path packages/nx/dist/package.json'
        );
        console.log(`✓ ${file}: Updated napi artifacts package-json-path`);
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(file, newContent);
      console.log(`✅ Updated ${file}\n`);
    } else {
      console.log(`⏭️  Skipped ${file} - no changes needed\n`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${file}: ${error.message}`);
  }
}

console.log('Migration complete!');
