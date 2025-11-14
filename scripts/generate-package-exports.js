#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * This script generates comprehensive exports fields for all Nx packages
 * with proper ESM support and @nx/nx-source custom condition for development.
 */

const WORKSPACE_ROOT = path.join(__dirname, '..');
const PACKAGES_DIR = path.join(WORKSPACE_ROOT, 'packages');

// Known package-specific export patterns based on analysis
const PACKAGE_EXPORT_PATTERNS = {
  devkit: {
    rootEntries: [
      'testing',
      'internal',
      'internal-testing-utils',
      'ngcli-adapter',
    ],
    wildcards: [
      './src/generators/*',
      './src/generators/plugin-migrations/*',
      './src/utils/*',
      './src/utils/async-iterable/*',
      './src/utils/catalog/*',
    ],
  },
  js: {
    rootEntries: ['internal', 'babel', 'typescript'],
    wildcards: [
      './src/utils/*',
      './src/utils/typescript/*',
      './src/utils/assets/*',
      './src/utils/package-json/*',
      './src/utils/swc/*',
      './src/generators/*',
      './src/generators/library/*',
      './src/generators/library/utils/*',
      './src/plugins/*',
      './src/plugins/typescript/*',
      './src/plugins/jest/*',
      './plugins/*',
      './plugins/jest/*',
    ],
  },
  cypress: {
    wildcards: ['./plugins/*', './src/utils/*'],
  },
  vite: {
    wildcards: ['./plugins/*', './src/utils/*', './src/executors/*'],
  },
  'module-federation': {
    rootEntries: ['webpack', 'angular', 'rspack', 'rspack.js', 'url-helpers'],
    wildcards: ['./src/executors/*', './src/utils/*'],
  },
  webpack: {
    rootEntries: ['app-plugin'],
    wildcards: [
      './src/plugins/*',
      './src/utils/*',
      './src/executors/*',
      './src/executors/*/lib/*',
      './src/executors/*/schema.json',
    ],
  },
  angular: {
    rootEntries: ['mf', 'module-federation'],
    wildcards: [
      './plugins/*',
      './src/utils/*',
      './src/generators/*',
      './src/executors/*',
    ],
  },
  react: {
    rootEntries: ['mf'],
    wildcards: [
      './plugins/*',
      './src/utils/*',
      './src/generators/*',
      './src/generators/*/lib/*',
      './src/generators/*/schema.json',
      './src/executors/*',
      './src/executors/*/lib/*',
      './src/executors/*/schema.json',
      './src/module-federation/*',
    ],
  },
  eslint: {
    wildcards: [
      './src/generators/*',
      './src/generators/utils/*',
      './src/utils/*',
    ],
  },
  workspace: {
    wildcards: ['./src/utilities/*', './src/utilities/typescript/*'],
  },
  rspack: {
    rootEntries: ['module-federation'],
    wildcards: ['./src/utils/*', './src/executors/*', './src/plugins/*'],
  },
  web: {
    wildcards: ['./src/utils/*', './plugins/*'],
  },
  node: {
    wildcards: ['./src/utils/*', './src/generators/*'],
  },
  jest: {
    wildcards: ['./plugins/*', './src/utils/*'],
  },
  playwright: {
    rootEntries: ['plugin'],
    wildcards: ['./src/utils/*'],
  },
  next: {
    wildcards: ['./plugins/*', './src/utils/*'],
  },
  storybook: {
    wildcards: ['./plugins/*', './src/utils/*'],
  },
  nuxt: {
    rootEntries: ['plugin'],
  },
  nest: {
    wildcards: ['./src/utils/*'],
  },
  express: {
    wildcards: ['./src/utils/*'],
  },
  vue: {
    wildcards: ['./src/utils/*'],
  },
  detox: {
    wildcards: ['./plugins/*'],
  },
  expo: {
    wildcards: ['./plugins/*', './src/utils/*'],
  },
  'react-native': {
    wildcards: ['./plugins/*', './src/utils/*'],
  },
  remix: {
    wildcards: ['./plugins/*', './src/utils/*'],
  },
  rollup: {
    wildcards: ['./src/utils/*', './src/plugins/*'],
  },
  esbuild: {
    wildcards: ['./src/utils/*', './plugins/*'],
  },
};

// Default pattern for packages not specifically configured
const DEFAULT_PATTERN = {
  rootEntries: [],
  wildcards: [
    './src/utils/*',
    './src/generators/*',
    './src/executors/*',
    './plugins/*',
  ],
};

/**
 * Creates export condition object for TypeScript/JavaScript files
 */
function createCodeExport(distPath, srcPath) {
  return {
    import: distPath,
    types: distPath.replace('.js', '.d.ts'),
    '@nx/nx-source': srcPath,
  };
}

/**
 * Generates exports object for a package
 */
function generateExports(packageName, packagePath) {
  const exports = {};
  const packagePattern =
    PACKAGE_EXPORT_PATTERNS[packageName] || DEFAULT_PATTERN;

  // 1. Root export
  exports['.'] = createCodeExport('./dist/index.js', './src/index.ts');

  // 2. package.json (always included)
  exports['./package.json'] = './package.json';

  // 3. Metadata JSON files
  ['migrations.json', 'generators.json', 'executors.json'].forEach((file) => {
    const filePath = path.join(packagePath, file);
    if (fs.existsSync(filePath)) {
      exports[`./${file}`] = `./${file}`;
    }
  });

  // 4. Root-level entry points (testing.ts, internal.ts, etc.)
  if (packagePattern.rootEntries && packagePattern.rootEntries.length > 0) {
    packagePattern.rootEntries.forEach((entry) => {
      // Check both .ts and .js extensions (some files might be .js only)
      const tsPath = path.join(packagePath, `${entry}.ts`);
      const jsPath = path.join(packagePath, `${entry}.js`);
      const srcPath = path.join(packagePath, 'src', `${entry}.ts`);

      if (fs.existsSync(tsPath)) {
        exports[`./${entry}`] = createCodeExport(
          `./dist/${entry}.js`,
          `./${entry}.ts`
        );
      } else if (fs.existsSync(jsPath)) {
        exports[`./${entry}`] = createCodeExport(
          `./dist/${entry}.js`,
          `./${entry}.js`
        );
      } else if (fs.existsSync(srcPath)) {
        exports[`./${entry}`] = createCodeExport(
          `./dist/${entry}.js`,
          `./src/${entry}.ts`
        );
      }
    });
  }

  // 5. Wildcard patterns for deep imports
  if (packagePattern.wildcards && packagePattern.wildcards.length > 0) {
    packagePattern.wildcards.forEach((pattern) => {
      // For schema.json patterns, use simple string export
      if (pattern.endsWith('schema.json')) {
        exports[pattern] = pattern;
      } else {
        // For code patterns, create conditional exports
        // For wildcards (ending with /*), we need to add explicit file extensions
        if (pattern.endsWith('/*')) {
          const distPattern = pattern.replace('./src/', './dist/');
          const srcPattern = pattern;

          exports[pattern] = {
            import: `${distPattern}.js`,
            types: `${distPattern}.d.ts`,
            '@nx/nx-source': `${srcPattern}.ts`,
          };
        } else {
          // For specific paths, convert to dist and src paths
          const distPattern = pattern
            .replace('./src/', './dist/')
            .replace('.ts', '.js');
          const srcPattern = pattern.endsWith('.js') ? pattern : pattern;

          exports[pattern] = createCodeExport(distPattern, srcPattern);
        }
      }
    });
  }

  return exports;
}

/**
 * Updates or adds exports field to package.json
 */
function updatePackageJson(packagePath, exports, dryRun = false) {
  const packageJsonPath = path.join(packagePath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    console.log(`⚠️  No package.json found at ${packageJsonPath}`);
    return false;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const packageName = packageJson.name;

  // Merge with existing exports if present
  const existingExports = packageJson.exports || {};
  const mergedExports = { ...exports };

  // For packages with existing exports, preserve any custom exports not in our generated set
  if (Object.keys(existingExports).length > 0) {
    console.log(`📝 Package ${packageName} has existing exports, merging...`);

    // Add @nx/nx-source condition to existing exports
    Object.keys(existingExports).forEach((key) => {
      const existing = existingExports[key];

      // Skip if we already have this in generated exports
      if (mergedExports[key]) {
        return;
      }

      // If it's a simple string export (like ./package.json), keep it
      if (typeof existing === 'string') {
        mergedExports[key] = existing;
      }
      // If it's an object with import/types, add @nx/nx-source
      else if (typeof existing === 'object' && existing.import) {
        // Try to infer source path
        const importPath = existing.import;
        const srcPath = importPath
          .replace('./dist/', './src/')
          .replace('.js', '.ts');

        mergedExports[key] = {
          ...existing,
          '@nx/nx-source': srcPath,
        };
      }
    });
  }

  packageJson.exports = mergedExports;

  if (dryRun) {
    console.log(`\n📦 ${packageName}`);
    console.log(JSON.stringify(mergedExports, null, 2));
    return true;
  }

  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + '\n'
  );
  console.log(`✅ Updated ${packageName}`);
  return true;
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const packageFilter = args.find((arg) => !arg.startsWith('--'));

  console.log('🚀 Generating package.json exports fields...\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No files will be modified\n');
  }

  const packages = fs
    .readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => !name.startsWith('.'))
    .filter((name) => {
      if (!packageFilter) return true;
      return name === packageFilter || name.includes(packageFilter);
    });

  console.log(`📦 Processing ${packages.length} packages...\n`);

  let successCount = 0;
  let failCount = 0;

  packages.forEach((packageName) => {
    const packagePath = path.join(PACKAGES_DIR, packageName);

    try {
      const exports = generateExports(packageName, packagePath);
      const success = updatePackageJson(packagePath, exports, dryRun);

      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (error) {
      console.error(`❌ Error processing ${packageName}:`, error.message);
      failCount++;
    }
  });

  console.log(`\n✨ Done!`);
  console.log(`   ✅ Success: ${successCount}`);
  if (failCount > 0) {
    console.log(`   ❌ Failed: ${failCount}`);
  }

  if (dryRun) {
    console.log('\n💡 Run without --dry-run to apply changes');
  }
}

main();
