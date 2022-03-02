import { readProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { join } from 'path';
import { LibraryGeneratorSchema } from '../../utils/schema';
import { libraryGenerator } from '../library/library';
import { convertToSwcGenerator } from './convert-to-swc';

describe('convert to swc', () => {
  let tree: Tree;

  const defaultLibGenerationOptions: Omit<LibraryGeneratorSchema, 'name'> = {
    skipTsConfig: false,
    unitTestRunner: 'jest',
    skipFormat: false,
    linter: 'eslint',
    testEnvironment: 'jsdom',
    js: false,
    pascalCaseFiles: false,
    strict: true,
    config: 'project',
    compiler: 'tsc',
  };

  beforeAll(() => {
    tree = createTreeWithEmptyWorkspace(2);
  });

  it('should convert tsc to swc', async () => {
    await libraryGenerator(tree, {
      ...defaultLibGenerationOptions,
      name: 'tsc-lib',
      buildable: true,
    });

    expect(
      readProjectConfiguration(tree, 'tsc-lib').targets['build']['executor']
    ).toEqual('@nrwl/js:tsc');

    await convertToSwcGenerator(tree, { project: 'tsc-lib' });

    expect(
      readProjectConfiguration(tree, 'tsc-lib').targets['build']['executor']
    ).toEqual('@nrwl/js:swc');
    expect(
      tree.exists(
        join(readProjectConfiguration(tree, 'tsc-lib').root, '.swcrc')
      )
    ).toEqual(true);
    expect(tree.read('package.json', 'utf-8')).toContain('@swc/core');
  });
});
