import {
  addProjectConfiguration,
  readProjectConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import updateSwcrcPath from './update-swcrc-path';

describe('update-swcrc-path migration', () => {
  it('should replace relative `swcrcPath` option with absolute `swcrc`', async () => {
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'test-package', {
      root: 'packages/test-package',
      targets: {
        build: {
          executor: '@nrwl/js:swc',
          options: {
            swcrcPath: 'config/swcrc.json',
            somethingThatShouldNotBeRemoved: true,
          },
        },
      },
    });

    await updateSwcrcPath(tree);

    const { targets, root } = readProjectConfiguration(tree, 'test-package');
    expect(root).toBe('packages/test-package');
    expect(targets.build.options.somethingThatShouldNotBeRemoved).toBeDefined();
    expect(targets.build.options.swcrcPath).toBeUndefined();
    expect(targets.build.options.swcrc).toBe(
      'packages/test-package/config/swcrc.json'
    );
  });
});
