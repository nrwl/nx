import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import {
  callRule,
  createEmptyWorkspace,
  runSchematic,
} from '@nrwl/workspace/testing';
import { Schema } from '../schema';
import { readFileSync } from 'fs';
import { join } from 'path';
import { updateJestConfig } from './update-jest-config';

describe('updateRootJestConfig Rule', () => {
  let tree: UnitTestTree;
  let schema: Schema;

  beforeEach(async () => {
    tree = new UnitTestTree(Tree.empty());
    tree = createEmptyWorkspace(tree) as UnitTestTree;

    schema = {
      projectName: 'my-lib',
      skipFormat: false,
      forceRemove: false,
    };

    tree = await runSchematic('lib', { name: 'my-lib' }, tree);

    tree.overwrite(
      'jest.config.js',
      readFileSync(join(__dirname, './test-files/jest.config.js')).toString()
    );
  });

  it('should delete lib project ref from root jest config', async () => {
    const jestConfig = tree.readContent('jest.config.js');

    expect(jestConfig).toMatchSnapshot();

    tree = (await callRule(updateJestConfig(schema), tree)) as UnitTestTree;

    const updatedJestConfig = tree.readContent('jest.config.js');

    expect(updatedJestConfig).toMatchSnapshot();
  });
});
