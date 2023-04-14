import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { generateTestApplication } from '../../generators/utils/testing';
import removeBrowserlistConfig, {
  DEFAULT_BROWSERS,
} from './remove-browserlist-config';

describe('Migration to delete Browserslist configurations', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await generateTestApplication(tree, {
      name: 'test',
    });
  });

  describe('given the Browserslist config matches the default', () => {
    it('should delete ".browserslistrc" file', async () => {
      tree.write(
        'apps/test/src/app/.browserslistrc',
        DEFAULT_BROWSERS.join('\n')
      );
      expect(tree.exists('apps/test/src/app/.browserslistrc')).toBeTruthy();

      await removeBrowserlistConfig(tree);
      expect(tree.exists('apps/test/src/app/.browserslistrc')).toBeFalsy();
    });

    it(`should not delete "browserslist" in 'node_modules'`, async () => {
      tree.write('node_modules/browserslist', DEFAULT_BROWSERS.join('\n'));
      tree.write('node_modules/.browserslistrc', DEFAULT_BROWSERS.join('\n'));

      await removeBrowserlistConfig(tree);
      expect(tree.exists('node_modules/browserslist')).toBeTruthy();
      expect(tree.exists('node_modules/.browserslistrc')).toBeTruthy();
    });
  });

  describe('given the Browserslist config does not match the default', () => {
    it('should not delete "browserslist"', async () => {
      tree.write('apps/test/src/app/browserslist', 'last 1 Chrome version');

      await removeBrowserlistConfig(tree);
      expect(tree.exists('apps/test/src/app/browserslist')).toBeTruthy();
    });

    it('should not delete ".browserslistrc"', async () => {
      tree.write('apps/test/src/app/.browserslistrc', 'last 1 Chrome version');

      await removeBrowserlistConfig(tree);
      expect(tree.exists('apps/test/src/app/.browserslistrc')).toBeTruthy();
    });

    it('should delete ".browserslistrc" file when it only includes non supported ES5 browsers', async () => {
      tree.write(
        'apps/test/src/app/.browserslistrc',
        [...DEFAULT_BROWSERS, 'IE 10'].join('\n')
      );
      expect(tree.exists('apps/test/src/app/.browserslistrc')).toBeTruthy();

      await removeBrowserlistConfig(tree);
      expect(tree.exists('apps/test/src/app/.browserslistrc')).toBeFalsy();
    });

    it('should not delete ".browserslistrc" file when it includes additional config sections', async () => {
      tree.write(
        'apps/test/src/app/.browserslistrc',
        `
      ${DEFAULT_BROWSERS.join('\n')}
      [modern]
      last 1 chrome version
      `
      );
      expect(tree.exists('apps/test/src/app/.browserslistrc')).toBeTruthy();

      await removeBrowserlistConfig(tree);
      expect(tree.exists('apps/test/src/app/.browserslistrc')).toBeTruthy();
    });
  });
});
