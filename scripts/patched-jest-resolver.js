'use strict';
const path = require('path');
const fs = require('fs');

/**
 * Custom resolver which will respect package exports (until Jest supports it natively
 * by resolving https://github.com/facebook/jest/issues/9771)
 *
 * Also needed for TypeScript project references support:
 * - ts-jest doesn't support TypeScript project references (https://github.com/kulshekhar/ts-jest/issues/1648)
 * - When using TS project references, Jest needs to resolve imports like '@nx/devkit' to TypeScript source files
 * - Without this resolver, Jest will fail to resolve these imports correctly
 */
const enhancedResolver = require('enhanced-resolve').create.sync({
  conditionNames: ['require', 'node', 'default'],
  extensions: ['.js', '.json', '.node', '.ts', '.tsx'],
});

if (
  process.argv[1].indexOf('jest-worker') > -1 ||
  (process.argv.length >= 4 && process.argv[3].split(':')[1] === 'test')
) {
  const root = path.join(__dirname, '..', 'tmp', 'unit');
  try {
    if (!fs.existsSync(root)) {
      fs.mkdirSync(root);
    }
  } catch (_err) {}
  process.env.NX_WORKSPACE_ROOT_PATH = root;
}

const excludedPackages = [
  '@nx/conformance',
  '@nx/owners',
  '@nx/key',
  '@nx/s3-cache',
  '@nx/azure-cache',
  '@nx/gcs-cache',
  '@nx/shared-fs-cache',
];

module.exports = function (modulePath, options) {
  // Skip sequencer
  if (modulePath === 'jest-sequencer-@jest/test-sequencer') return;

  // Only use custom resolution for workspace packages
  // Let default resolver handle published packages and everything else
  const workspacePackages = [
    '@nx/rollup',
    '@nx/eslint',
    '@nx/vite',
    '@nx/jest',
    '@nx/docker',
    '@nx/js',
    '@nx/next',
    '@nx/storybook',
    '@nx/rsbuild',
    '@nx/react-native',
    '@nx/express',
    '@nx/web',
    '@nx/vue',
    '@nx/workspace',
    '@nx/module-federation',
    '@nx/rspack',
    '@nx/eslint-plugin',
    '@nx/angular',
    '@nx/create-nx-plugin',
    '@nx/create-nx-workspace',
    '@nx/detox',
    '@nx/devkit',
    '@nx/esbuild',
    '@nx/expo',
    '@nx/gradle',
    '@nx/nest',
    '@nx/node',
    '@nx/nuxt',
    '@nx/playwright',
    '@nx/react',
    '@nx/remix',
    '@nx/webpack',
  ];

  const isWorkspacePackage =
    workspacePackages.some((pkg) => modulePath.startsWith(pkg)) ||
    modulePath.startsWith('nx/');

  if (!isWorkspacePackage) {
    // Global modules which must be resolved by defaultResolver
    if (['child_process', 'fs', 'http', 'path'].includes(modulePath)) {
      return options.defaultResolver(modulePath, options);
    }

    return enhancedResolver(path.resolve(options.basedir), modulePath);
  }

  const ext = path.extname(modulePath);

  // Handle CSS imports
  if (ext === '.css' || ext === '.scss' || ext === '.sass' || ext === '.less') {
    return require.resolve('identity-obj-proxy');
  }

  try {
    // Detect if we're running from e2e directory
    const isE2E = options.rootDir.includes('/e2e/');

    // For e2e tests, skip workspace resolution and use default resolver
    if (isE2E) {
      return options.defaultResolver(modulePath, options);
    }

    // Find workspace root - avoid filesystem lookups inside node_modules
    // For PNPM workspaces, we know the structure: workspace/packages/packageName
    let workspaceRoot = options.rootDir;

    // If we're in a packages subdirectory, go up two levels to workspace root
    if (workspaceRoot.includes('/packages/')) {
      const packagesIndex = workspaceRoot.lastIndexOf('/packages/');
      workspaceRoot = workspaceRoot.substring(0, packagesIndex);
    } else {
      // Fallback: go up directories until we find packages/ (but check pnpm-lock.yaml for validation)
      while (workspaceRoot && workspaceRoot !== path.dirname(workspaceRoot)) {
        const pnpmLock = path.join(workspaceRoot, 'pnpm-lock.yaml');
        const packagesDir = path.join(workspaceRoot, 'packages');
        if (fs.existsSync(pnpmLock) && fs.existsSync(packagesDir)) {
          break;
        }
        workspaceRoot = path.dirname(workspaceRoot);
      }
    }

    const packagesPath = path.join(workspaceRoot, 'packages');

    // Handle main @nx/* package imports (e.g., '@nx/devkit', '@nx/js')
    const nxPackageMatch = modulePath.match(/^@nx\/([^/]+)$/);
    if (nxPackageMatch) {
      const packageName = nxPackageMatch[1];

      // Check if this package exists in workspace
      const packageDir = path.join(packagesPath, packageName);

      // Try different entry points based on package structure
      const possibleEntries = [
        path.join(packageDir, 'index.ts'),
        path.join(packageDir, 'src', 'index.ts'),
      ];

      for (const entry of possibleEntries) {
        if (fs.existsSync(entry) && fs.lstatSync(entry).isFile()) {
          return entry;
        }
      }
    }

    // Handle @nx/*/src/* subpath imports (e.g., '@nx/devkit/src/utils/something')
    const nxSubpathMatch = modulePath.match(/^@nx\/([^/]+)\/src\/(.+)$/);
    if (nxSubpathMatch) {
      const packageName = nxSubpathMatch[1];
      const subpath = nxSubpathMatch[2];

      // Try different patterns for subpath resolution
      const possiblePaths = [
        path.join(packagesPath, packageName, 'src', subpath + '.ts'), // Direct file
        path.join(packagesPath, packageName, 'src', subpath, 'index.ts'), // Directory with index.ts
      ];

      for (const possiblePath of possiblePaths) {
        if (
          fs.existsSync(possiblePath) &&
          fs.lstatSync(possiblePath).isFile()
        ) {
          return possiblePath;
        }
      }
    }

    // Handle @nx/* other subpaths (e.g., '@nx/devkit/testing', '@nx/devkit/package.json')
    const nxOtherMatch = modulePath.match(/^@nx\/([^/]+)\/(.+)$/);
    if (nxOtherMatch) {
      const packageName = nxOtherMatch[1];
      const subpath = nxOtherMatch[2];

      const packageDir = path.join(packagesPath, packageName);

      // Try different patterns for subpath resolution
      const possiblePaths = [
        path.join(packageDir, subpath), // For files like package.json
        path.join(packageDir, subpath + '.ts'),
        path.join(packageDir, 'src', subpath + '.ts'),
      ];

      for (const possiblePath of possiblePaths) {
        if (
          fs.existsSync(possiblePath) &&
          fs.lstatSync(possiblePath).isFile()
        ) {
          return possiblePath;
        }
      }
    }

    // Handle nx/src/* imports (direct nx package imports)
    const nxSrcMatch = modulePath.match(/^nx\/src\/(.+)$/);
    if (nxSrcMatch) {
      const subpath = nxSrcMatch[1];
      const resolvedPath = path.join(
        packagesPath,
        'nx',
        'src',
        subpath + '.ts'
      );
      if (fs.existsSync(resolvedPath) && fs.lstatSync(resolvedPath).isFile()) {
        return resolvedPath;
      }
    }

    // Handle nx/package.json specifically
    if (modulePath === 'nx/package.json') {
      return path.join(packagesPath, 'nx', 'package.json');
    }

    // Handle other nx/* patterns
    const nxOtherPatternMatch = modulePath.match(/^nx\/(.+)$/);
    if (nxOtherPatternMatch) {
      const subpath = nxOtherPatternMatch[1];
      const resolvedPath = path.join(packagesPath, 'nx', subpath + '.ts');
      if (fs.existsSync(resolvedPath)) {
        return resolvedPath;
      }
    }

    // Block excluded Nx packages from auto-resolution
    if (
      modulePath.startsWith('@nx/') &&
      !modulePath.startsWith('@nx/powerpack-') &&
      !excludedPackages.some((pkg) => modulePath.startsWith(pkg))
    ) {
      // If we get here, it means the workspace package couldn't be resolved above
      // This might indicate a missing file or incorrect import
      console.warn(
        `[resolver] Could not resolve workspace package: ${modulePath}`
      );
    }

    return enhancedResolver(path.resolve(options.basedir), modulePath);
  } catch (e) {
    // Final fallback: use default resolver for packages we can't handle
    // This preserves the old behavior where packages that couldn't be resolved
    // by the custom resolver would fall back to default resolution
    try {
      return options.defaultResolver(modulePath, options);
    } catch (defaultResolverError) {
      throw new Error(`[resolver] Could not resolve module: ${modulePath}`);
    }
  }
};
