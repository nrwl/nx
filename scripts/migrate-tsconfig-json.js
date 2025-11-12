#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * Ensure all tsconfig.json files reference tsconfig.spec.json
 */

const tsconfigFiles = glob.sync('packages/*/tsconfig.json');

console.log(`Found ${tsconfigFiles.length} tsconfig.json files to check`);

for (const file of tsconfigFiles) {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    const config = JSON.parse(content);

    const packageDir = path.dirname(file);
    const specPath = path.join(packageDir, 'tsconfig.spec.json');

    // Check if tsconfig.spec.json exists
    if (!fs.existsSync(specPath)) {
      console.log(`⏭️  Skipping ${file} - no tsconfig.spec.json found\n`);
      continue;
    }

    // Ensure references array exists
    if (!config.references) {
      config.references = [];
    }

    // Check if tsconfig.spec.json is already referenced
    const hasSpecReference = config.references.some(
      (ref) =>
        ref.path === './tsconfig.spec.json' || ref.path === 'tsconfig.spec.json'
    );

    if (!hasSpecReference) {
      // Add reference to tsconfig.spec.json
      config.references.push({ path: './tsconfig.spec.json' });
      console.log(`✓ ${file}: Added reference to ./tsconfig.spec.json`);

      // Write back with proper formatting
      fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
      console.log(`✅ Updated ${file}\n`);
    } else {
      console.log(
        `⏭️  Skipped ${file} - already has tsconfig.spec.json reference\n`
      );
    }
  } catch (error) {
    console.error(`❌ Error processing ${file}: ${error.message}`);
  }
}

console.log('Migration complete!');
