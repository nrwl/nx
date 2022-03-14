import * as depcheck from 'depcheck';

// Ignore packages that are defined here per package
const IGNORE_MATCHES = {
  '*': [
    'nx',
    '@nrwl/cli',
    '@nrwl/workspace',
    'prettier',
    'typescript',
    'dotenv',
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
    'postcss',
    'postcss-import',
    'postcss-preset-env',
    'postcss-url',
    'sass',
    'stylus',
    'tailwindcss',
  ],
  cli: ['nx'],
  cypress: ['cypress', '@angular-devkit/schematics', '@nrwl/cypress'],
  devkit: ['@angular-devkit/architect', 'rxjs'],
  'eslint-plugin-nx': ['@angular-eslint/eslint-plugin'],
  jest: [
    'jest',
    '@jest/types',
    'identity-obj-proxy',
    '@angular-devkit/schematics',
  ],
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
    'babel-plugin-emotion',
    'babel-plugin-styled-components',
    'rollup',
    'webpack',
    '@angular-devkit/core',
    '@angular-devkit/schematics',
  ],
  storybook: [
    '@angular-devkit/architect',
    '@angular-devkit/core',
    '@angular-devkit/schematics',
    '@storybook/addon-knobs',
    '@storybook/addon-essentials',
    '@storybook/core',
    'rxjs',
  ],
  nx: [
    '@angular-devkit/build-angular',
    '@angular-devkit/schematics',
    '@angular-devkit/core',
    '@angular-devkit/architect',
  ],
  web: [
    // we don't want to bloat the install of @nrwl/web by including @swc/core and swc-loader as a dependency.
    '@swc/core',
    'swc-loader',

    'fibers',
    'node-sass',
  ],
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
    '@nrwl/devkit',
  ],
  nest: ['semver'],
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
      'src/migrations/**',
    ],
  };
  let { missing } = await depcheck(path, {
    ...options,
    package: { dependencies },
  });

  const packagesMissing = Object.keys(missing).filter(
    (m) =>
      !IGNORE_MATCHES['*'].includes(m) &&
      !(IGNORE_MATCHES[name] || []).includes(m)
  );

  if (verbose) {
    console.log(`> ${name}`);
    packagesMissing.map((p) => {
      console.log(p, missing[p]);
    });
  }

  return packagesMissing;
}
