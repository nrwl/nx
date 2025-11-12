#!/usr/bin/env node

/**
 * Creates readme-template.md files for packages that don't already have them
 * Part of Phase 3.2 of the local dist migration
 */

const { readdirSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');

const PACKAGES_DIR = join(__dirname, '..', 'packages');

// Packages that already have readme-template.md and should be skipped
const SKIP_PACKAGES = new Set(['maven', 'dotnet', 'angular-rspack', 'angular-rspack-compiler']);

// Template based on maven pattern
function getReadmeTemplate(packageName) {
  return `# @nx/${packageName}

{{links}}

{{content}}

{{resources}}
`;
}

function createReadmeTemplate(packageName) {
  const packageDir = join(PACKAGES_DIR, packageName);
  const readmeTemplatePath = join(packageDir, 'readme-template.md');

  if (existsSync(readmeTemplatePath)) {
    console.log(`  - ${packageName}: Already has readme-template.md`);
    return false;
  }

  const template = getReadmeTemplate(packageName);
  writeFileSync(readmeTemplatePath, template, 'utf-8');
  console.log(`  ✓ ${packageName}: Created readme-template.md`);
  return true;
}

function main() {
  console.log('📝 Creating readme-template.md files\n');

  const packages = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .filter(name => !SKIP_PACKAGES.has(name));

  let created = 0;

  for (const packageName of packages) {
    if (createReadmeTemplate(packageName)) {
      created++;
    }
  }

  console.log(`\n✅ Complete! Created ${created} readme-template.md files`);
}

main();
