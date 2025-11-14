#!/usr/bin/env node

/**
 * Adds .js extensions to relative imports in TypeScript files
 * Part of Phase 4.1 of the local dist migration
 *
 * This script processes all .ts files (except .d.ts) in packages/
 * and adds .js extensions to relative import/export paths
 */

const { readdirSync, readFileSync, writeFileSync, statSync } = require('fs');
const { join, extname, dirname, basename } = require('path');

const PACKAGES_DIR = join(__dirname, '..', 'packages');

// Patterns to match import/export statements with relative paths
const IMPORT_EXPORT_PATTERNS = [
  // import { ... } from './path' or '../path'
  /from\s+(['"])(\.[^'"]+)(?<!\.js|\.json|\.mjs|\.cjs|\.d\.ts)\1/g,
  // export { ... } from './path' or '../path'
  /from\s+(['"])(\.[^'"]+)(?<!\.js|\.json|\.mjs|\.cjs|\.d\.ts)\1/g,
  // import './path' or '../path'
  /import\s+(['"])(\.[^'"]+)(?<!\.js|\.json|\.mjs|\.cjs|\.d\.ts)\1/g,
  // export * from './path' or '../path'
  /export\s+\*\s+from\s+(['"])(\.[^'"]+)(?<!\.js|\.json|\.mjs|\.cjs|\.d\.ts)\1/g,
];

function shouldProcessFile(filePath) {
  // Skip .d.ts files, spec files, and non-TypeScript files
  const fileName = basename(filePath);
  return (
    fileName.endsWith('.ts') &&
    !fileName.endsWith('.d.ts') &&
    !fileName.endsWith('.spec.ts') &&
    !fileName.endsWith('.test.ts')
  );
}

function addJsExtensions(content) {
  let modified = content;
  let hasChanges = false;

  // Match all import/export statements with relative paths
  const staticImportRegex =
    /((?:import|export)(?:\s+\*)?(?:\s+\{[^}]*\})?\s+from\s+|import\s+)(['"])(\.[^'"]+?)(?<!\.js|\.json|\.mjs|\.cjs|\.d\.ts)\2/g;

  modified = modified.replace(
    staticImportRegex,
    (match, prefix, quote, path) => {
      // Don't modify if already has extension
      if (
        path.endsWith('.js') ||
        path.endsWith('.json') ||
        path.endsWith('.mjs') ||
        path.endsWith('.cjs') ||
        path.endsWith('.d.ts')
      ) {
        return match;
      }

      hasChanges = true;
      return `${prefix}${quote}${path}.js${quote}`;
    }
  );

  // Match dynamic imports: import('./path') or import("./path")
  const dynamicImportRegex =
    /\bimport\s*\(\s*(['"])(\.[^'"]+?)(?<!\.js|\.json|\.mjs|\.cjs|\.d\.ts)\1\s*\)/g;

  modified = modified.replace(dynamicImportRegex, (match, quote, path) => {
    // Don't modify if already has extension
    if (
      path.endsWith('.js') ||
      path.endsWith('.json') ||
      path.endsWith('.mjs') ||
      path.endsWith('.cjs') ||
      path.endsWith('.d.ts')
    ) {
      return match;
    }

    hasChanges = true;
    return `import(${quote}${path}.js${quote})`;
  });

  return { modified, hasChanges };
}

function processFile(filePath) {
  if (!shouldProcessFile(filePath)) {
    return false;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const { modified, hasChanges } = addJsExtensions(content);

    if (hasChanges) {
      writeFileSync(filePath, modified, 'utf-8');
      return true;
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }

  return false;
}

function processDirectory(dir) {
  let filesModified = 0;

  try {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules, dist, and other build directories
        if (
          entry.name === 'node_modules' ||
          entry.name === 'dist' ||
          entry.name === '.nx' ||
          entry.name === 'tmp'
        ) {
          continue;
        }
        filesModified += processDirectory(fullPath);
      } else if (entry.isFile()) {
        if (processFile(fullPath)) {
          filesModified++;
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }

  return filesModified;
}

function processPackage(packageName) {
  const packageDir = join(PACKAGES_DIR, packageName);
  console.log(`\n📦 Processing package: ${packageName}`);

  const filesModified = processDirectory(packageDir);

  if (filesModified > 0) {
    console.log(`  ✓ Modified ${filesModified} files`);
  } else {
    console.log(`  - No changes needed`);
  }

  return filesModified;
}

function main() {
  console.log('🔄 Adding .js extensions to relative imports\n');
  console.log('This may take a few minutes...\n');

  const packages = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  let totalFilesModified = 0;
  let packagesWithChanges = 0;

  for (const packageName of packages) {
    const filesModified = processPackage(packageName);
    if (filesModified > 0) {
      totalFilesModified += filesModified;
      packagesWithChanges++;
    }
  }

  console.log(`\n✅ Complete!`);
  console.log(
    `   ${totalFilesModified} files modified across ${packagesWithChanges} packages`
  );
  console.log('\n⚠️  Important: Run tests and build to verify the changes!');
}

main();
