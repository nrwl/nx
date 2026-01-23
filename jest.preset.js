// Ensure that the preset loads from node_modules rather than our local typescript source
const nxPreset = require('./node_modules/@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  testTimeout: 35000,
  testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
  transform: {
    '^.+\\.(html)$': 'ts-jest',
    '^.+\\.[tj]sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', dynamicImport: true },
          transform: {
            useDefineForClassFields: false,
          },
          experimental: {
            plugins: [['@swc-contrib/mut-cjs-exports', {}]],
          },
        },
        module: { type: 'commonjs' },
      },
    ],
  },
  resolver: '../../scripts/patched-jest-resolver.js',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageReporters: ['html'],
  maxWorkers: 1,
  testEnvironment: 'node',
  setupFiles: ['../../scripts/unit-test-setup.js'],
  moduleNameMapper: {
    // Mock ora to avoid ESM issues - ora@9+ is ESM-only and breaks Jest
    '^ora$': '<rootDir>/../../scripts/jest-mocks/ora.js',
    // Handle both `import * as x` and `import x from` styles for CommonJS modules
    '^chalk$': '<rootDir>/../../scripts/jest-mocks/chalk.js',
    '^yargs-parser$': '<rootDir>/../../scripts/jest-mocks/yargs-parser.js',
    '^prettier$': '<rootDir>/../../scripts/jest-mocks/prettier.js',
  },
};
