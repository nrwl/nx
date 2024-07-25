import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readNxJson, Tree, updateNxJson } from '@nx/devkit';

import { ciWorkflowGenerator } from './generator';

describe('ci-workflow generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe.each([
    ['connected to nxCloud', true],
    ['not connected to nxCloud', false],
  ] as const)(`%s`, (_, connectedToCloud) => {
    let nxCloudAccessToken: string;

    beforeEach(() => {
      if (connectedToCloud) {
        const nxJson = readNxJson(tree);
        nxJson.nxCloudAccessToken = 'test';
        updateNxJson(tree, nxJson);
      } else {
        nxCloudAccessToken = process.env.NX_CLOUD_ACCESS_TOKEN;
        delete process.env.NX_CLOUD_ACCESS_TOKEN;
      }
    });

    afterEach(() => {
      if (connectedToCloud) {
        const nxJson = readNxJson(tree);
        delete nxJson.nxCloudAccessToken;
        updateNxJson(tree, nxJson);
      } else {
        process.env.NX_CLOUD_ACCESS_TOKEN = nxCloudAccessToken;
      }
    });
    describe.each([
      ['github', '.github/workflows/ci.yml'],
      ['circleci', '.circleci/config.yml'],
    ] as const)(`%s pipeline`, (ciProvider, output) => {
      it('should match snapshot', async () => {
        await ciWorkflowGenerator(tree, {
          name: 'CI',
          ci: ciProvider,
        });
        expect(tree.read(output, 'utf-8')).toMatchSnapshot();
      });
    });
  });
});
