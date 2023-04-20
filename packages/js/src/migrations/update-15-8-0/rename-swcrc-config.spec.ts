import {
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { libraryGenerator } from '../../generators/library/library';
import renameSwcrcConfig from './rename-swcrc-config';

describe('Rename swcrc file migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should migrate .lib.swcrc to .swcrc', async () => {
    await setup(tree);
    await renameSwcrcConfig(tree);

    expect(tree.exists('libs/my-lib/.lib.swcrc')).toBeFalsy();
    expect(tree.exists('libs/my-lib/.swcrc')).toBeTruthy();

    const jestConfig = tree.read('libs/my-lib/jest.config.ts', 'utf-8');
    expect(jestConfig).toContain(`fs.readFileSync(\`\${__dirname}/.swcrc\``);
    expect(jestConfig).toContain('swcJestConfig.swcrc = false');
  });

  it('should migrate custom path .lib.swcrc', async () => {
    await setup(tree);
    customSwcrcPath(tree);

    await renameSwcrcConfig(tree);

    expect(tree.exists('libs/my-lib/src/.lib.swcrc')).toBeFalsy();
    expect(tree.exists('libs/my-lib/src/.swcrc')).toBeTruthy();

    const projectConfig = readProjectConfiguration(tree, 'my-lib');
    expect(projectConfig.targets.build.options.swcrc).toEqual(
      'libs/my-lib/src/.swcrc'
    );
  });

  it('should do nothing if custom path swcrc is not named .lib.swcrc', async () => {
    await setup(tree);
    customSwcrcPath(tree, true);

    await renameSwcrcConfig(tree);

    expect(tree.exists('libs/my-lib/src/.custom.swcrc')).toBeTruthy();
    expect(tree.exists('libs/my-lib/src/.swcrc')).toBeFalsy();

    const projectConfig = readProjectConfiguration(tree, 'my-lib');
    expect(projectConfig.targets.build.options.swcrc).toEqual(
      'libs/my-lib/src/.custom.swcrc'
    );
  });
});

async function setup(tree: Tree) {
  await libraryGenerator(tree, {
    name: 'my-lib',
    bundler: 'swc',
    unitTestRunner: 'jest',
    config: 'project',
  });

  const projectConfig = readProjectConfiguration(tree, 'my-lib');
  projectConfig.targets.build.executor = '@nrwl/js:swc';
  projectConfig.targets.test.executor = '@nrwl/jest:jest';
  updateProjectConfiguration(tree, 'my-lib', projectConfig);

  tree.rename('libs/my-lib/.swcrc', 'libs/my-lib/.lib.swcrc');
  tree.write(
    'libs/my-lib/jest.config.ts',
    `
const fs = require('fs');

// Reading the SWC compilation config and remove the "exclude"
// for the test files to be compiled by SWC
const { exclude: _, ...swcJestConfig } = JSON.parse(
  fs.readFileSync(\`\${__dirname}/.lib.swcrc\`, 'utf-8')
);

module.exports = {
  displayName: 'my-lib',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/packages/vite',
};
`
  );
}

function customSwcrcPath(tree: Tree, custom = false) {
  tree.rename(
    'libs/my-lib/.lib.swcrc',
    custom ? 'libs/my-lib/src/.custom.swcrc' : 'libs/my-lib/src/.lib.swcrc'
  );
  const projectConfig = readProjectConfiguration(tree, 'my-lib');
  projectConfig.targets.build.options.swcrc = custom
    ? 'libs/my-lib/src/.custom.swcrc'
    : 'libs/my-lib/src/.lib.swcrc';
  updateProjectConfiguration(tree, 'my-lib', projectConfig);
}
