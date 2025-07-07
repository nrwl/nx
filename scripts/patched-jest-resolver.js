'use strict';
const path = require('path');
const fs = require('fs');

/**
 * Custom resolver which will respect package exports (until Jest supports it natively
 * by resolving https://github.com/facebook/jest/issues/9771)
 */
const enhancedResolver = require('enhanced-resolve').create.sync({
  conditionNames: ['require', 'node', 'default'],
  extensions: ['.js', '.json', '.node', '.ts', '.tsx'],
});

// Setup test environment for Jest workers (important for native functionality)
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
    return options.defaultResolver(modulePath, options);
  }

  const ext = path.extname(modulePath);

  // Handle CSS imports
  if (
    ext === '.css' ||
    ext === '.scss' ||
    ext === '.sass' ||
    ext === '.less' ||
    ext === '.styl'
  ) {
    return require.resolve('identity-obj-proxy');
  }

  try {
    // Detect if we're running from e2e directory
    const isE2E = options.rootDir.includes('/e2e/');

    // For e2e tests, skip workspace resolution and use default resolver
    if (isE2E) {
      return options.defaultResolver(modulePath, options);
    }

    const packagesPath = '../';

    // TS Solution: Allow specific workspace packages to be resolved to TypeScript source
    const tsWorkspacePackages = {
      '@nx/rollup': path.resolve(
        options.rootDir,
        `${packagesPath}rollup/index.ts`
      ),
      '@nx/eslint': path.resolve(
        options.rootDir,
        `${packagesPath}eslint/index.ts`
      ),
      '@nx/vite': path.resolve(options.rootDir, `${packagesPath}vite/index.ts`),
      '@nx/jest': path.resolve(options.rootDir, `${packagesPath}jest/index.ts`),
      '@nx/js': path.resolve(options.rootDir, `${packagesPath}js/src/index.ts`),
      // Additional packages where tests are working
      '@nx/next': path.resolve(options.rootDir, `${packagesPath}next/index.ts`),
      '@nx/storybook': path.resolve(
        options.rootDir,
        `${packagesPath}storybook/index.ts`
      ),
      '@nx/rsbuild': path.resolve(
        options.rootDir,
        `${packagesPath}rsbuild/index.ts`
      ),
      '@nx/react-native': path.resolve(
        options.rootDir,
        `${packagesPath}react-native/index.ts`
      ),
      '@nx/express': path.resolve(
        options.rootDir,
        `${packagesPath}express/index.ts`
      ),
      '@nx/web': path.resolve(options.rootDir, `${packagesPath}web/index.ts`),
      '@nx/vue': path.resolve(options.rootDir, `${packagesPath}vue/index.ts`),
      '@nx/workspace': path.resolve(
        options.rootDir,
        `${packagesPath}workspace/index.ts`
      ),
      '@nx/module-federation': path.resolve(
        options.rootDir,
        `${packagesPath}module-federation/index.ts`
      ),
      '@nx/react': path.resolve(
        options.rootDir,
        `${packagesPath}react/index.ts`
      ),
      '@nx/remix': path.resolve(
        options.rootDir,
        `${packagesPath}remix/index.ts`
      ),
      '@nx/webpack': path.resolve(
        options.rootDir,
        `${packagesPath}webpack/index.ts`
      ),
      '@nx/playwright': path.resolve(
        options.rootDir,
        `${packagesPath}playwright/index.ts`
      ),
      '@nx/rspack': path.resolve(
        options.rootDir,
        `${packagesPath}rspack/src/index.ts`
      ),
    };

    if (tsWorkspacePackages[modulePath]) {
      return tsWorkspacePackages[modulePath];
    }

    // Handle @nx/js/src/* paths
    if (modulePath.startsWith('@nx/js/src/')) {
      const relativePath = modulePath.replace('@nx/js/src/', '');
      return path.resolve(
        options.rootDir,
        `${packagesPath}js/src/`,
        relativePath + '.ts'
      );
    }

    // Handle @nx/eslint/src/* paths
    if (modulePath.startsWith('@nx/eslint/src/')) {
      const relativePath = modulePath.replace('@nx/eslint/src/', '');
      return path.resolve(
        options.rootDir,
        `${packagesPath}eslint/src/`,
        relativePath + '.ts'
      );
    }

    // Handle other packages with src/* structure where tests are working
    const srcPackages = [
      'rspack',
      'nx',
      'eslint-plugin',
      'react',
      'vite',
      'rollup',
      'workspace',
      'angular',
      'next',
      'node',
      'web',
      'webpack',
      'cypress',
      'jest',
    ];
    for (const pkg of srcPackages) {
      if (modulePath.startsWith(`@nx/${pkg}/src/`)) {
        const relativePath = modulePath.replace(`@nx/${pkg}/src/`, '');
        return path.resolve(
          options.rootDir,
          `${packagesPath}${pkg}/src/`,
          relativePath + '.ts'
        );
      }
    }

    // Handle nx/src/* paths (for direct nx package imports)
    if (modulePath.startsWith('nx/src/')) {
      const relativePath = modulePath.replace('nx/src/', '');
      return path.resolve(
        options.rootDir,
        `${packagesPath}nx/src/`,
        relativePath + '.ts'
      );
    }

    // Block other Nx packages from auto-resolution
    if (
      modulePath.startsWith('@nx/') &&
      !modulePath.startsWith('@nx/powerpack-') &&
      !excludedPackages.some((pkg) => modulePath.startsWith(pkg))
    ) {
      throw new Error('custom resolution blocked');
    }

    if (modulePath.startsWith('nx/') && !modulePath.startsWith('nx/src/'))
      throw new Error('custom resolution blocked');

    if (modulePath.includes('@nx/workspace')) {
      throw new Error(
        'Reference to local Nx package found. Use local version instead.'
      );
    }

    // Try enhanced resolver
    return enhancedResolver(path.resolve(options.basedir), modulePath);
  } catch (e) {
    // Skip all warnings since fallback to default resolver is working correctly
    // The enhanced resolver is expected to fail for many legitimate cases

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
