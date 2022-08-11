import update from './split-create-empty-tree';
import { createTreeWithEmptyWorkspace } from '../../../testing';
import { addProjectConfiguration, Tree } from '@nrwl/devkit';

const TS_FILE_THAT_DOESNT_USE_EITHER = `import { other } from '@nrwl/devkit/testing';
other();`;

const TS_FILE_THAT_USES_DEFAULT = `import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

createTreeWithEmptyWorkspace();
`;

const TS_FILE_THAT_USES_V1 = `import { createTreeWithEmptyV1Workspace } from '@nrwl/devkit/testing';

createTreeWithEmptyV1Workspace();
`;

const TS_FILE_THAT_SPECIFIED_V2 = `import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

createTreeWithEmptyWorkspace(2);
`;

const TS_FILE_THAT_SPECIFIED_V1_AND_IMPORTED_ALL = `import * as devkit from '@nrwl/devkit/testing';

devkit.createTreeWithEmptyWorkspace(1);
`;

const TS_FILE_THAT_SPECIFIED_V1_AND_IMPORTED_ALL_UPDATED = `import * as devkit from '@nrwl/devkit/testing';

devkit.createTreeWithEmptyV1Workspace();
`;

const TS_FILE_THAT_SPECIFIED_V1 = `import { createTreeWithEmptyWorkspace, other } from '@nrwl/devkit/testing';

devkit.createTreeWithEmptyWorkspace(1);
`;

const TS_FILE_THAT_SPECIFIED_V1_UPDATED = `import { createTreeWithEmptyV1Workspace, other } from '@nrwl/devkit/testing';

devkit.createTreeWithEmptyV1Workspace();
`;

const TS_FILE_THAT_SPECIFIED_BOTH = `import { createTreeWithEmptyWorkspace, other } from '@nrwl/devkit/testing';

devkit.createTreeWithEmptyWorkspace(1);
devkit.createTreeWithEmptyWorkspace(2);
`;

const TS_FILE_THAT_SPECIFIED_BOTH_UPDATED = `import { createTreeWithEmptyV1Workspace, createTreeWithEmptyWorkspace, other } from '@nrwl/devkit/testing';

devkit.createTreeWithEmptyV1Workspace();
devkit.createTreeWithEmptyWorkspace();
`;

const testCases = [
  {
    initial: TS_FILE_THAT_DOESNT_USE_EITHER,
    expected: TS_FILE_THAT_DOESNT_USE_EITHER,
    message: `doesn't use util`,
  },
  {
    initial: TS_FILE_THAT_USES_DEFAULT,
    expected: TS_FILE_THAT_USES_V1,
    message: `uses default value`,
  },
  {
    initial: TS_FILE_THAT_SPECIFIED_V2,
    expected: TS_FILE_THAT_USES_DEFAULT,
    message: 'only specified default',
  },
  {
    initial: TS_FILE_THAT_SPECIFIED_V1,
    expected: TS_FILE_THAT_SPECIFIED_V1_UPDATED,
    message: 'only specified v1',
  },
  {
    initial: TS_FILE_THAT_SPECIFIED_V1_AND_IMPORTED_ALL,
    expected: TS_FILE_THAT_SPECIFIED_V1_AND_IMPORTED_ALL_UPDATED,
    message: 'only specified v1, and imported all',
  },
  {
    initial: TS_FILE_THAT_SPECIFIED_BOTH,
    expected: TS_FILE_THAT_SPECIFIED_BOTH_UPDATED,
    message: 'specified both',
  },
];

describe('update-14-2-0-split-create-empty-tree', () => {
  it.each(testCases)(
    'should match expected if file $message',
    async ({ initial, expected }) => {
      const { tree, tsFilePath } = createTreeWithBoilerplate();
      tree.write(tsFilePath, initial);

      await update(tree);
      const contents = tree.read(tsFilePath).toString();
      expect(contents).toEqual(expected);
    }
  );
});

function createTreeWithBoilerplate(): { tree: Tree; tsFilePath: string } {
  const tree = createTreeWithEmptyWorkspace();
  const project = 'proj';
  addProjectConfiguration(tree, project, {
    root: `libs/${project}`,
  });
  return { tree, tsFilePath: `libs/${project}/some-file.ts` };
}
