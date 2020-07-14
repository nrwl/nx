import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';
import { readJsonInTree } from '../../utils/ast-utils';

describe('run-commands', () => {
  let appTree: Tree;

  beforeEach(async () => {
    const t = createEmptyWorkspace(Tree.empty());
    appTree = await runSchematic('lib', { name: 'lib' }, t);
  });

  it('should generate files', async () => {
    const tree = await runSchematic(
      'run-commands',
      {
        name: 'custom',
        project: 'lib',
        command: 'echo 1',
        cwd: '/packages/foo',
        outputs: '/dist/a, /dist/b, /dist/c',
      },
      appTree
    );
    const workspaceJson = readJsonInTree(tree, '/workspace.json');
    expect(workspaceJson.projects['lib'].architect['custom']).toEqual({
      builder: '@nrwl/workspace:run-commands',
      outputs: ['/dist/a', '/dist/b', '/dist/c'],
      options: {
        command: 'echo 1',
        cwd: '/packages/foo',
      },
    });
  });
});
