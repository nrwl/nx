#!/usr/bin/env node

/**
 * Creates .npmignore files for packages that don't already have them
 * Part of Phase 3.1 of the local dist migration
 */

const { readdirSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');

const PACKAGES_DIR = join(__dirname, '..', 'packages');

// Packages that already have .npmignore and should be skipped
const SKIP_PACKAGES = new Set(['nx', 'angular-rspack', 'angular-rspack-compiler']);

// Template based on angular-rspack pattern
const NPMIGNORE_TEMPLATE = `!dist
dist/tsconfig.lib.tsbuildinfo
.eslintrc.json
project.json
tsconfig.json
tsconfig.lib.json
tsconfig.spec.json
jest.config.cts
vitest*.config.*
src/**/*.ts
!src/**/*.d.ts
**/*.spec.ts
**/*.test.ts
mocks/
test-utils/
readme-template.md
`;

function createNpmignore(packageName) {
  const packageDir = join(PACKAGES_DIR, packageName);
  const npmignorePath = join(packageDir, '.npmignore');

  if (existsSync(npmignorePath)) {
    console.log(`  - ${packageName}: Already has .npmignore`);
    return false;
  }

  writeFileSync(npmignorePath, NPMIGNORE_TEMPLATE, 'utf-8');
  console.log(`  ✓ ${packageName}: Created .npmignore`);
  return true;
}

function main() {
  console.log('📝 Creating .npmignore files\n');

  const packages = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .filter(name => !SKIP_PACKAGES.has(name));

  let created = 0;

  for (const packageName of packages) {
    if (createNpmignore(packageName)) {
      created++;
    }
  }

  console.log(`\n✅ Complete! Created ${created} .npmignore files`);
}

main();
