import * as depcheck from 'depcheck';

// Ignore packages that are defined here per package
const IGNORE_MATCHES = {
  '*': ['@nrwl/tao', '@nrwl/workspace', 'prettier', 'typescript', 'dotenv'],
  angular: [
    '@angular-devkit/architect',
    '@angular-devkit/build-angular',
    '@angular-devkit/core',
    '@angular/compiler-cli',
    '@angular/core',
    '@angular/router',
    '@ngrx/effects',
    '@ngrx/router-store',
    '@ngrx/store',
    'injection-js',
    'ng-packagr',
    'rxjs',
  ],
  cli: ['@nrwl/cli'],
  cypress: ['cypress'],
  jest: ['jest', '@jest/types', 'identity-obj-proxy'],
  linter: ['eslint', '@angular-devkit/schematics'],
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
  ],
  storybook: [
    '@angular-devkit/architect',
    '@angular-devkit/core',
    '@angular-devkit/schematics',
    '@storybook/addon-knobs',
    '@storybook/core',
    'rxjs',
  ],
  tao: ['@angular-devkit/build-angular'],
  web: ['fibers', 'node-sass'],
  workspace: ['tslint'],
};

export default async function getMissingDependencies(
  name: string,
  path: string,
  dependencies: JSON,
  verbose: boolean
) {
  const options: any = {
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
