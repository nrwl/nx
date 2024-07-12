import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readNxJson, Tree, updateNxJson } from '@nx/devkit';

import { ciWorkflowGenerator } from './generator';

describe('ci-workflow generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    const nxJson = readNxJson(tree);
    nxJson.nxCloudAccessToken = 'test';
    updateNxJson(tree, nxJson);
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
