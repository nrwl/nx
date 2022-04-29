import { stripIndents, Tree } from '@nrwl/devkit';
import { createTree, createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { libraryGenerator as workspaceLib } from '@nrwl/workspace';
import {
  updateExportsJestConfig,
  updateRootFiles,
  updateToDefaultExport,
} from './update-exports-jest-config';

describe('Jest Migration (v14.1.0)', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace(2);
  });

  it('should update root jest files', () => {
    tree.write(
      'jest.config.ts',
      stripIndents`
      const { getJestProjects } = require('@nrwl/jest');

      module.exports = {
        projects: getJestProjects()
      };`
    );

    tree.write(
      'jest.preset.ts',
      stripIndents`
      const nxPreset = require('@nrwl/jest/preset');

      module.exports = { ...nxPreset };`
    );

    const status = updateRootFiles(tree);

    expect(status).toEqual({ didUpdateRootPreset: true });
    expect(tree.read('jest.config.ts', 'utf-8')).toEqual(stripIndents`
      const { getJestProjects } = require('@nrwl/jest');

      export default {
        projects: getJestProjects()
      };
    `);
    expect(tree.read('jest.preset.js', 'utf-8')).toEqual(stripIndents`
      const nxPreset = require('@nrwl/jest/preset').default;

      module.exports = { ...nxPreset };`);
  });

  it('should update individual project jest configs', async () => {
    await workspaceLib(tree, { name: 'lib-one' });
    tree.write(
      'libs/lib-one/jest.config.ts',
      `
const nxPreset = require('@nrwl/jest/preset');
const someOtherImport = require('../something/else.js');
module.exports = {
  ...someOtherImport,
  ...nxPreset,
  displayName: 'lib-one',
  preset: '../../jest.preset.ts',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
      stringifyContentPathRegex: '\\\\.(html|svg)$',
    },
  },
  coverageDirectory: '../../coverage/apps/lib-one',
  transform: {
    '^.+\\\\.(ts|mjs|js|html)$': 'jest-preset-angular',
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\\\.mjs$)'],
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
};
`
    );
    updateExportsJestConfig(tree);

    const config = tree.read('libs/lib-one/jest.config.ts', 'utf-8');
    expect(config).toMatchSnapshot();
  });

  it('should convert module.exports => export default', () => {
    tree = createTree();

    tree.write(
      'jest.config.js',
      stripIndents`
  const { getJestProjects } = require('@nrwl/jest');
  const nxPreset = require('@nrwl/jest/preset');
  
  
  const someFn = () => ({more: 'stuff'});
  module.export.abc = someFn;
  module.exports = {
    ...nxPreset,
    more: 'stuff',
    someFn,
    projects: getJestProjects()
  };`
    );
    updateToDefaultExport(tree, 'jest.config.js');

    expect(tree.read('jest.config.js', 'utf-8')).toMatchSnapshot();
  });
});
