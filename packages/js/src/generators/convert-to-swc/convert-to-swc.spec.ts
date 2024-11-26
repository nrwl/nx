import 'nx/src/internal-testing-utils/mock-project-graph';

import { readProjectConfiguration, Tree } from '@nx/devkit';
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

  beforeAll(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('/.gitignore', '');
    tree.write('/.gitignore', '');
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
    expect(tree.read('package.json', 'utf-8')).toContain('@swc/core');
    expect(tree.read('tsc-lib/package.json', 'utf-8')).toContain(
      '@swc/helpers'
    );
  });
});
