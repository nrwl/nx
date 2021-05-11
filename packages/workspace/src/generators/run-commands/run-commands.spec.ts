import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { readJson } from '@nrwl/devkit';
import runCommands from './run-commands';
import { libraryGenerator } from '../library/library';

describe('run-commands', () => {
  it('should generate a target', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const opts = {
      name: 'custom',
      project: 'lib',
      command: 'echo 1',
      cwd: '/packages/foo',
      outputs: '/dist/a, /dist/b, /dist/c',
    };

    await libraryGenerator(tree, {
      name: 'lib',
    });

    await runCommands(tree, opts);

    const customTarget = readJson(tree, 'workspace.json').projects['lib']
      .architect['custom'];
    expect(customTarget).toEqual({
      builder: '@nrwl/workspace:run-commands',
      outputs: ['/dist/a', '/dist/b', '/dist/c'],
      options: {
        command: 'echo 1',
        cwd: '/packages/foo',
      },
    });
  });
});
