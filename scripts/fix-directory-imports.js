#!/usr/bin/env node

/**
 * Fixes directory imports to explicitly reference index.js
 * Converts: from '../native.js' -> from '../native/index.js'
 * When '../native' is a directory with an index.js file
 */

const { readdirSync, readFileSync, writeFileSync, existsSync, statSync } = require('fs');
const { join, dirname, basename } = require('path');

const PACKAGES_DIR = join(__dirname, '..', 'packages');

function isDirectory(path) {
  try {
    return existsSync(path) && statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function hasIndexFile(dirPath) {
  return (
    existsSync(join(dirPath, 'index.ts')) ||
    existsSync(join(dirPath, 'index.js')) ||
    existsSync(join(dirPath, 'index.d.ts'))
  );
}

function fixDirectoryImports(content, filePath) {
  let modified = content;
  let hasChanges = false;

  const fileDir = dirname(filePath);

  // Match imports ending in .js (both static and dynamic)
  const staticImportRegex = /((?:import|export)(?:\s+\*)?(?:\s+\{[^}]*\})?\s+from\s+|import\s+)(['"])(\.\.?[^'"]+?)\.js\2/g;
  const dynamicImportRegex = /\bimport\s*\(\s*(['"])(\.\.?[^'"]+?)\.js\1\s*\)/g;

  // Fix static imports
  modified = modified.replace(staticImportRegex, (match, prefix, quote, path) => {
    // Resolve the path relative to the file
    const resolvedPath = join(fileDir, path);

    // Check if this is a directory with an index file
    if (isDirectory(resolvedPath) && hasIndexFile(resolvedPath)) {
      hasChanges = true;
      return `${prefix}${quote}${path}/index.js${quote}`;
    }

    return match;
  });

  // Fix dynamic imports
  modified = modified.replace(dynamicImportRegex, (match, quote, path) => {
    // Resolve the path relative to the file
    const resolvedPath = join(fileDir, path);

    // Check if this is a directory with an index file
    if (isDirectory(resolvedPath) && hasIndexFile(resolvedPath)) {
      hasChanges = true;
      return `import(${quote}${path}/index.js${quote})`;
    }

    return match;
  });

  return { modified, hasChanges };
}

function processFile(filePath) {
  const fileName = basename(filePath);
  if (!fileName.endsWith('.ts') || fileName.endsWith('.d.ts')) {
    return false;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const { modified, hasChanges } = fixDirectoryImports(content, filePath);

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

function main() {
  console.log('🔄 Fixing directory imports to use explicit index.js\n');

  const packages = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  let totalFilesModified = 0;

  for (const packageName of packages) {
    const packageDir = join(PACKAGES_DIR, packageName);
    const filesModified = processDirectory(packageDir);
    if (filesModified > 0) {
      console.log(`📦 ${packageName}: ${filesModified} files modified`);
      totalFilesModified += filesModified;
    }
  }

  console.log(`\n✅ Complete! ${totalFilesModified} files modified`);
}

main();
