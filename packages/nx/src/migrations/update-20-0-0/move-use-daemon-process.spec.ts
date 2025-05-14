import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';

import update from './move-use-daemon-process';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';

describe('move-use-daemon-process migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should migrate useDaemonProcess', async () => {
    updateNxJson(tree, {
      tasksRunnerOptions: {
        default: {
          options: {
            useDaemonProcess: false,
          },
        },
      },
    });

    await update(tree);

    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "useDaemonProcess": false,
      }
    `);
  });
});
