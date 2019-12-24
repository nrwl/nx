import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runSchematic } from '../../../utils/testing';
import { Schema } from '../schema';
import { checkDestination } from './check-destination';

describe('checkDestination Rule', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createEmptyWorkspace(Tree.empty());
    tree = await runSchematic('lib', { name: 'my-lib' }, tree);
  });

  it('should throw an error if the path is not explicit', async () => {
    const schema: Schema = {
      projectName: 'my-lib',
      destination: '../apps/not-an-app'
    };

    await expect(callRule(checkDestination(schema), tree)).rejects.toThrow(
      `Invalid destination: [${schema.destination}] - Please specify explicit path.`
    );
  });

  it('should throw an error if the path already exists', async () => {
    tree = await runSchematic('lib', { name: 'my-other-lib' }, tree);

    const schema: Schema = {
      projectName: 'my-lib',
      destination: 'my-other-lib'
    };

    await expect(callRule(checkDestination(schema), tree)).rejects.toThrow(
      `Invalid destination: [${schema.destination}] - Path is not empty.`
    );
  });

  it('should NOT throw an error if the path is available', async () => {
    const schema: Schema = {
      projectName: 'my-lib',
      destination: 'my-other-lib'
    };

    await expect(
      callRule(checkDestination(schema), tree)
    ).resolves.not.toThrow();
  });

  it('should normalize the destination', async () => {
    const schema: Schema = {
      projectName: 'my-lib',
      destination: '/my-other-lib//wibble'
    };

    await callRule(checkDestination(schema), tree);

    expect(schema.destination).toBe('my-other-lib/wibble');
  });
});
