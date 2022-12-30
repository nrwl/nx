import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runSchematic } from '../../utils/testing';
import { checkProjectExists } from './check-project-exists';

describe('checkProjectExists Rule', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createEmptyWorkspace(Tree.empty());
  });

  it('should throw an error if the project does NOT exist', async () => {
    const schema = {
      projectName: 'my-lib',
    };

    await expect(callRule(checkProjectExists(schema), tree)).rejects.toThrow(
      `Project not found in workspace: [${schema.projectName}]`
    );
  });

  it('should NOT throw an error if the project exists', async () => {
    tree = await runSchematic('lib', { name: 'my-lib' }, tree);

    const schema = {
      projectName: 'my-lib',
    };

    await expect(
      callRule(checkProjectExists(schema), tree)
    ).resolves.not.toThrow();
  });
});
