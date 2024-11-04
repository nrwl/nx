import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { join } from 'path';
import { LibraryGeneratorSchema } from '../library/schema';
import { libraryGenerator as jsLibraryGenerator } from '../library/library';
import { convertToSwcGenerator } from './convert-to-swc';

describe('convert to swc', () => {
  let tree: Tree;

  const defaultLibGenerationOptions: Omit<LibraryGeneratorSchema, 'directory'> =
    {
      skipTsConfig: false,
      unitTestRunner: 'jest',
      skipFormat: false,
      linter: 'eslint',
      testEnvironment: 'jsdom',
      js: false,
      strict: true,
      config: 'project',
      bundler: 'tsc',
    };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should convert tsc to swc', async () => {
    await jsLibraryGenerator(tree, {
      ...defaultLibGenerationOptions,
      directory: 'tsc-lib',
      bundler: 'tsc',
    });

    expect(
      readProjectConfiguration(tree, 'tsc-lib').targets['build']['executor']
    ).toEqual('@nx/js:tsc');

    await convertToSwcGenerator(tree, { project: 'tsc-lib' });

    expect(
      readProjectConfiguration(tree, 'tsc-lib').targets['build']['executor']
    ).toEqual('@nx/js:swc');
    expect(
      tree.exists(
        join(readProjectConfiguration(tree, 'tsc-lib').root, '.swcrc')
      )
    ).toEqual(true);
    expect(
      readJson(tree, 'package.json').devDependencies['@swc/core']
    ).toBeDefined();
    expect(
      readJson(tree, 'tsc-lib/package.json').dependencies['@swc/helpers']
    ).toBeDefined();
  });

  it('should handle project configuration without targets', async () => {
    addProjectConfiguration(tree, 'lib1', { root: 'lib1' });

    await expect(
      convertToSwcGenerator(tree, { project: 'lib1' })
    ).resolves.not.toThrow();
  });

  it('should not add swc dependencies when no target was updated', async () => {
    addProjectConfiguration(tree, 'lib1', { root: 'lib1' });
    writeJson(tree, 'lib1/package.json', { dependencies: {} });

    await convertToSwcGenerator(tree, { project: 'lib1' });

    expect(
      readJson(tree, 'package.json').devDependencies['@swc/core']
    ).not.toBeDefined();
    expect(
      readJson(tree, 'lib1/package.json').dependencies['@swc/helpers']
    ).not.toBeDefined();
  });
});
