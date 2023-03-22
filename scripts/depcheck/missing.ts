import * as depcheck from 'depcheck';
import { join } from 'path';

// Ignore packages that are defined here per package
const IGNORE_MATCHES_IN_PACKAGE = {
  '*': [
    'nx',
    'prettier',
    'typescript',
    'rxjs',
    '@nrwl/cli',
    '@nrwl/workspace',
    // These are installed as needed and should not be added to package.json
    '@nrwl/cypress',
    '@nrwl/jest',
    '@nrwl/rollup',
    '@nrwl/storybook',
    '@nrwl/vite',
    '@nrwl/webpack',
  ],
  angular: [
    '@angular-devkit/architect',
    '@angular-devkit/build-angular',
    '@angular-devkit/core',
    '@angular/compiler',
    '@angular/compiler-cli',
    '@angular/core',
    '@angular/router',
    '@ngrx/effects',
    '@ngrx/router-store',
    '@ngrx/store',
    '@storybook/angular',
    '@module-federation/node',
    'rxjs',
    'semver',
    // installed dynamically by the library generator
    'ng-packagr',
    // ng-packagr deps, some are handled if not installed
    'injection-js',
    'browserslist',
    'cacache',
    'find-cache-dir',
    'less',
    'node-sass',
    'node-sass-tilde-importer',
    'ora',
    'convert-source-map',
    'postcss',
    'postcss-import',
    'postcss-preset-env',
    'postcss-url',
    'sass',
    'stylus',
    'tailwindcss',
  ],
  cli: ['nx'],
  cypress: ['cypress', '@angular-devkit/schematics', '@nrwl/cypress', 'vite'],
  devkit: [
    '@angular-devkit/architect',
    '@angular-devkit/schematics',
    'rxjs',
    'webpack',
  ],
  'eslint-plugin-nx': ['@angular-eslint/eslint-plugin'],
  jest: [
    'jest',
    '@jest/types',
    'identity-obj-proxy',
    '@angular-devkit/schematics',
  ],
  js: ['@nrwl/linter'],
  linter: [
    'eslint',
    '@angular-devkit/schematics',
    '@angular-devkit/architect',
    // Installed and uninstalled dynamically when the conversion generator runs
    'tslint-to-eslint-config',
    // Resolved from the end user's own workspace installation dynamically
    '@typescript-eslint/eslint-plugin',
  ],
  next: [
    '@angular-devkit/architect',
    '@nrwl/devkit',
    'express',
    'http-proxy-middleware',
    'next',
    'rxjs',
    'tsconfig-paths-webpack-plugin',
    'webpack',
  ],
  react: [
    // These are brought in by the webpack, rollup, or vite packages via init generators.
    '@babel/preset-react',
    '@module-federation/node',
    '@phenomnomnominal/tsquery',
    '@pmmmwh/react-refresh-webpack-plugin',
    '@svgr/rollup',
    '@rollup/plugin-url',
    '@svgr/webpack',
    '@swc/jest',
    'babel-jest',
    'babel-loader',
    'babel-plugin-emotion',
    'babel-plugin-styled-components',
    'css-loader',
    'file-loader',
    'less-loader',
    'react-refresh',
    'rollup',
    'sass',
    'sass-loader',
    'style-loader',
    'stylus-loader',
    'swc-loader',
    'tsconfig-paths-webpack-plugin',
    'url-loader',
    'webpack',
    'webpack-merge',
  ],
  rollup: ['@swc/core'],
  storybook: [
    '@angular-devkit/architect',
    '@angular-devkit/core',
    '@angular-devkit/schematics',
    '@storybook/addon-knobs',
    '@storybook/addon-essentials',
    '@storybook/core',
    '@storybook/core-server',
    '@storybook/types',
    // lazy installed with ensurePackage
    '@nrwl/web',
    'rxjs',
  ],
  nx: [
    '@angular-devkit/build-angular',
    '@angular-devkit/schematics',
    '@angular-devkit/core',
    '@angular-devkit/architect',
    '@angular/cli',
    '@nrwl/angular',
    '@nestjs/cli', // nx init nest makes use of nestjs cli (which should be available in NestJS CLI app) to parse the nest-cli.json file
    'ts-node', // We *may* fall back on ts-node, but we want to encourage the use of @swc-node instead so we don't explicitly list ts-node as an optional dep
    '@nrwl/nx-android-arm-eabi', // native optional deps
    '@nrwl/nx-android-arm64', // native optional deps
    '@nrwl/nx-darwin-arm64', // native optional deps
    '@nrwl/nx-darwin-universal', // native optional deps
    '@nrwl/nx-darwin-x64', // native optional deps
    '@nrwl/nx-freebsd-x64', // native optional deps
    '@nrwl/nx-linux-arm-gnueabihf', // native optional deps
    '@nrwl/nx-linux-arm64-gnu', // native optional deps
    '@nrwl/nx-linux-arm64-musl', // native optional deps
    '@nrwl/nx-linux-x64-gnu', // native optional deps
    '@nrwl/nx-linux-x64-musl', // native optional deps
    '@nrwl/nx-win32-arm64-msvc', // native optional deps
    '@nrwl/nx-win32-ia32-msvc', // native optional deps
    '@nrwl/nx-win32-x64-msvc', // native optional deps
    'memfs', // used in mock for handling .node files in tests
  ],
  web: [
    // we don't want to bloat the install of @nrwl/web by including @swc/core and swc-loader as a dependency.
    '@swc/core',
    'swc-loader',

    'fibers',
    'node-sass',
  ],
  webpack: ['@swc/core', 'style-loader', 'swc-loader'],
  workspace: [
    'tslint',
    '@angular-devkit/architect',
    '@angular-devkit/core',
    '@angular-devkit/schematics',
    'webpack',
    'webpack-dev-server',
    '@nrwl/cli',
    '@nrwl/jest',
    '@nrwl/linter',
    'tsconfig-paths',
  ],
  nest: ['semver'],
  'make-angular-cli-faster': ['@angular/core'],
};

const IGNORE_MATCHES_BY_FILE: Record<string, string[]> = {
  '@storybook/core': [
    join(
      __dirname,
      '../../packages/angular/src/migrations/update-12-3-0/update-storybook.ts'
    ),
  ],
};

export default async function getMissingDependencies(
  name: string,
  path: string,
  dependencies: JSON,
  verbose: boolean
) {
  const options: any = {
    /**
     * If a dependency is exclusively used via a TypeScript type import
     * e.g. `import type { Foo } from 'bar';`
     * ...then we do not want it to trigger a missing dependency warning
     * because it is not required at runtime.
     *
     * We can achieve this by overriding the default detector for
     * ImportDeclaration nodes to check the `importKind` value.
     */
    detectors: [
      ...Object.entries(depcheck.detector).map(([detectorName, detectorFn]) => {
        // Use all the default detectors, apart from 'importDeclaration'
        if (detectorName !== 'importDeclaration') {
          return detectorFn;
        }
        const customImportDeclarationDetector: depcheck.Detector = (node) => {
          return node.type === 'ImportDeclaration' &&
            node.source &&
            node.source.value &&
            node.importKind !== 'type'
            ? [node.source.value]
            : [];
        };
        return customImportDeclarationDetector;
      }),
    ],
    skipMissing: false, // skip calculation of missing dependencies
    ignorePatterns: [
      '*.d.ts',
      '.eslintrc.json',
      '*.spec*',
      'src/schematics/**/files/**',
    ],
  };
  let { missing } = await depcheck(path, {
    ...options,
    package: { dependencies },
  });

  const packagesMissing = Object.keys(missing).filter(
    (m) =>
      !IGNORE_MATCHES_IN_PACKAGE['*'].includes(m) &&
      !(IGNORE_MATCHES_IN_PACKAGE[name] || []).includes(m) &&
      missing[m].filter(
        (occurence) => !IGNORE_MATCHES_BY_FILE[m]?.includes(occurence)
      ).length
  );

  if (verbose) {
    console.log(`> ${name}`);
    packagesMissing.map((p) => {
      console.log(p, missing[p]);
    });
  }

  return packagesMissing;
}
