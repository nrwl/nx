jest.mock('../../utils/remix-config');
import * as remixConfigUtils from '../../utils/remix-config';

import { addProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import errorBoundaryGenerator from './error-boundary.impl';

describe('ErrorBoundary', () => {
  beforeEach(() => {
    (remixConfigUtils.getRemixConfigValues as jest.Mock) = jest.fn(() =>
      Promise.resolve({
        ignoredRouteFiles: ['**/.*'],
      })
    );
  });
  describe('--apiVersion=2', () => {
    const nameAndDirectoryFormat = 'as-provided';
    it('should correctly add the ErrorBoundary to the route file', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      addProjectConfiguration(tree, 'demo', {
        name: 'demo',
        root: '.',
        sourceRoot: '.',
        projectType: 'application',
      });
      const routeFilePath = `app/routes/test.tsx`;
      tree.write(routeFilePath, ``);
      tree.write('remix.config.js', `module.exports = {}`);

      // ACT
      await errorBoundaryGenerator(tree, {
        nameAndDirectoryFormat,
        path: routeFilePath,
      });

      // ASSERT
      expect(tree.read(routeFilePath, 'utf-8')).toMatchSnapshot();
    });

    it('should error when the route file cannot be found', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      addProjectConfiguration(tree, 'demo', {
        name: 'demo',
        root: '.',
        sourceRoot: '.',
        projectType: 'application',
      });
      const routeFilePath = `app/routes/test.tsx`;
      tree.write(routeFilePath, ``);
      tree.write('remix.config.js', `module.exports = {}`);

      // ACT & ASSERT
      await expect(
        errorBoundaryGenerator(tree, {
          nameAndDirectoryFormat,
          path: `my-route.tsx`,
        })
      ).rejects.toThrow();
    });
  });
});
