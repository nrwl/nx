import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree } from '@nx/devkit';

import { ciWorkflowGenerator } from './generator';

describe('ci-workflow generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
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
