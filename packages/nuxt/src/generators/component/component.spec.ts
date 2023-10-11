import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree } from '@nx/devkit';
import { applicationGenerator } from '../application/application';
import { componentGenerator } from './component';

describe('component', () => {
  let tree: Tree;
  const name = 'my-app';

  describe('generated files content - as-provided', () => {
    beforeAll(async () => {
      tree = createTreeWithEmptyWorkspace();
      await applicationGenerator(tree, {
        name,
        projectNameAndRootFormat: 'as-provided',
      });
    });
    it('should create a new vue component in the correct location', async () => {
      await componentGenerator(tree, {
        name: 'hello',
        project: name,
      });

      expect(tree.exists('my-app/src/components/hello/hello.vue')).toBeTruthy();
    });
  });
});
