import * as depcheck from 'depcheck';

// Ignore packages that are defined here per package.
// Note: If @babel/parser fails to parse a file, then its imports will not be detected.
const IGNORE_MATCHES = {
  '*': ['@nx/devkit', '@nx/workspace', 'chalk', 'tslib', '@swc/helpers'],
  angular: ['@angular-devkit/schematics', '@schematics/angular', 'http-server'],
  cli: [],
  cypress: [],
  devkit: [],
  'eslint-plugin': [],
  jest: [
    // This is used for the type import only, we should remove it.
    'jest-resolve',
  ],
  linter: [],
  nest: ['@nestjs/schematics'],
  next: [],
  node: [],
  'nx-plugin': [],
  react: [],
  rollup: [],
  storybook: [],
  nx: ['glob'],
  vite: [],
  web: ['http-server'],
  webpack: [
    // These are not being picked up because @babel/parser is failing on the files that import them.
    'css-loader',
    'style-loader',
    'ts-loader',
    'webpack-merge',
  ],
  workspace: [
    '@parcel/watcher',
    'cli-cursor',
    'cli-spinners',
    'dotenv',
    'figures',
    'flat',
    'minimatch',
    'npm-run-path',
    'open',
    'tmp',
    'yargs',
  ],
};

export default async function getUnusedDependencies(
  name: string,
  path: string,
  dependencies: JSON,
  verbose: boolean
) {
  const options: any = {
    detectors: [
      ...Object.entries(depcheck.detector).map(([detectorName, detectorFn]) => {
        // Use all the default detectors, apart from 'importDeclaration'
        if (detectorName !== 'importDeclaration') {
          return detectorFn;
        }
        const customImportDeclarationDetector: depcheck.Detector = (node) => {
          switch (node.type) {
            case 'ImportDeclaration':
              return node.source &&
                node.source.value &&
                node.importKind !== 'type'
                ? [node.source.value]
                : [];
            case 'CallExpression':
              return (node.callee?.name === 'require' ||
                (node.callee?.object?.name === 'require' &&
                  node.callee?.property?.name === 'resolve')) &&
                node.arguments[0]?.value
                ? [node.arguments[0].value]
                : [];
            default:
              return [];
          }
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
  let { dependencies: unused } = await depcheck(path, {
    ...options,
    package: { dependencies },
  });

  const unusedPackages = unused.filter(
    (m) =>
      !IGNORE_MATCHES['*'].includes(m) &&
      !(IGNORE_MATCHES[name] || []).includes(m)
  );

  return unusedPackages;
}
