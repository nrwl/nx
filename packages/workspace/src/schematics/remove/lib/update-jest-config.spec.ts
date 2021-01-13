import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { readFileSync } from 'fs';
import { join } from 'path';

import { Schema } from '../schema';
import { updateJestConfig } from './update-jest-config';
import { libraryGenerator } from '../../library/library';

describe('updateRootJestConfig', () => {
  let tree: Tree;
  let schema: Schema;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    schema = {
      projectName: 'my-lib',
      skipFormat: false,
      forceRemove: false,
    };

    await libraryGenerator(tree, {
      name: 'my-lib',
    });

    tree.write(
      'jest.config.js',
      readFileSync(join(__dirname, './test-files/jest.config.js')).toString()
    );
  });

  it('should delete lib project ref from root jest config', async () => {
    const jestConfig = tree.read('jest.config.js').toString();

    expect(jestConfig).toMatchSnapshot();

    updateJestConfig(tree, schema);

    const updatedJestConfig = tree.read('jest.config.js').toString();

    expect(updatedJestConfig).toMatchSnapshot();
  });
});
