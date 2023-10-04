import { readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { readFileSync } from 'fs';
import { join } from 'path';

import { Schema } from '../schema';
import { updateJestConfig } from './update-jest-config';

// nx-ignore-next-line
const { libraryGenerator } = require('@nx/js');

describe('updateRootJestConfig', () => {
  let tree: Tree;
  let schema: Schema;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    schema = {
      projectName: 'my-lib',
      skipFormat: false,
      forceRemove: false,
    };

    await libraryGenerator(tree, {
      name: 'my-lib',
    });
    await libraryGenerator(tree, {
      name: 'my-other-lib',
    });

    tree.write(
      'jest.config.ts',
      readFileSync(join(__dirname, './__fixtures__/jest.config.ts'), 'utf-8')
    );
  });

  it('should delete lib project ref from root jest config', async () => {
    const jestConfig = tree.read('jest.config.ts', 'utf-8');

    expect(jestConfig).toMatchSnapshot();

    updateJestConfig(tree, schema, readProjectConfiguration(tree, 'my-lib'));

    const updatedJestConfig = tree.read('jest.config.ts', 'utf-8');

    expect(updatedJestConfig).toMatchSnapshot();

    updateJestConfig(
      tree,
      { ...schema, projectName: 'my-other-lib' },
      readProjectConfiguration(tree, 'my-other-lib')
    );

    const updatedJestConfig2 = tree.read('jest.config.ts', 'utf-8');

    expect(updatedJestConfig2).toMatchSnapshot();
  });

  it('should not delete lib project ref from root jest config if there is no project jest config', () => {
    tree.delete('libs/my-lib/jest.config.ts');

    const originalRootJestConfig = tree.read('jest.config.ts', 'utf-8');
    tree.write(
      'jest.config.ts',
      originalRootJestConfig.replace(`'<rootDir>/libs/my-lib',`, '')
    );

    updateJestConfig(tree, schema, readProjectConfiguration(tree, 'my-lib'));

    const rootJestConfig = tree.read('jest.config.ts', 'utf-8');

    expect(rootJestConfig).toMatchSnapshot();
  });

  it('should delete project if root jest config is not a multi-project config', () => {
    tree.write(
      'jest.config.ts',
      readFileSync(
        join(__dirname, './__fixtures__/jest-project.config.ts'),
        'utf-8'
      )
    );

    updateJestConfig(tree, schema, readProjectConfiguration(tree, 'my-lib'));

    const rootJestConfig = tree.read('jest.config.ts', 'utf-8');

    expect(rootJestConfig).toMatchSnapshot();
  });
});
