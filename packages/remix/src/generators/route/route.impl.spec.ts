jest.mock('../../utils/remix-config');
import * as remixConfigUtils from '../../utils/remix-config';
import { Tree } from '@nx/devkit';
import { NameAndDirectoryFormat } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import applicationGenerator from '../application/application.impl';
import presetGenerator from '../preset/preset.impl';
import routeGenerator from './route.impl';

describe('route', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    tree.write('.gitignore', `/node_modules/dist`);

    (remixConfigUtils.getRemixConfigValues as jest.Mock) = jest.fn(() =>
      Promise.resolve({
        ignoredRouteFiles: ['**/.*'],
      })
    );
  });
  describe.each([
    [
      'derived',
      'path/to/example',
      '',
      'apps/demo/app/routes/path/to/example.tsx',
      'apps/demo/app/styles/path/to/example.css',
      'PathToExample',
      'demo',
    ],
    [
      'as-provided',
      'apps/demo/app/routes/path/to/example',
      'app/routes',
      'apps/demo/app/routes/path/to/example.tsx',
      'apps/demo/app/styles/path/to/example.css',
      'Example',
      '',
    ],
  ])(
    `--nameAndDirectoryFormat=%s`,
    (
      nameAndDirectoryFormat: NameAndDirectoryFormat,
      path,
      standalonePath,
      expectedRoutePath,
      expectedStylePath,
      expectedComponentName,
      project: string
    ) => {
      it('should add route component', async () => {
        await applicationGenerator(tree, { name: 'demo' });
        await routeGenerator(tree, {
          project,
          path,
          nameAndDirectoryFormat,
          style: 'css',
          loader: true,
          action: true,
          meta: true,
          skipChecks: false,
        });

        const content = tree.read(expectedRoutePath, 'utf-8');
        expect(content).toMatchSnapshot();
        expect(content).toMatch('LinksFunction');
        expect(content).toMatch(`function ${expectedComponentName}(`);
        expect(tree.exists(expectedStylePath)).toBeTruthy();
      }, 25_000);

      it('should support --style=none', async () => {
        await applicationGenerator(tree, { name: 'demo' });
        await routeGenerator(tree, {
          project,
          path,
          nameAndDirectoryFormat,
          style: 'none',
          loader: true,
          action: true,
          meta: true,
          skipChecks: false,
        });

        const content = tree.read(expectedRoutePath).toString();
        expect(content).not.toMatch('LinksFunction');
        expect(tree.exists(expectedStylePath)).toBeFalsy();
      });

      it('should handle trailing and prefix slashes', async () => {
        await applicationGenerator(tree, { name: 'demo' });
        await routeGenerator(tree, {
          project,
          path: `/${path}/`,
          nameAndDirectoryFormat,
          style: 'css',
          loader: true,
          action: true,
          meta: true,
          skipChecks: false,
        });

        const content = tree.read(expectedRoutePath).toString();
        expect(content).toMatch(`function ${expectedComponentName}(`);
      });

      it('should handle routes that end in a file', async () => {
        await applicationGenerator(tree, { name: 'demo' });
        await routeGenerator(tree, {
          project: 'demo',
          path: `${path}.tsx`,
          nameAndDirectoryFormat,
          style: 'css',
          loader: true,
          action: true,
          meta: true,
          skipChecks: false,
        });

        const content = tree.read(expectedRoutePath).toString();
        expect(content).toMatch(`function ${expectedComponentName}(`);
      });

      it('should handle routes that have a param', async () => {
        const componentName =
          nameAndDirectoryFormat === 'as-provided'
            ? 'WithParam'
            : `${expectedComponentName}WithParam`;
        await applicationGenerator(tree, { name: 'demo' });
        await routeGenerator(tree, {
          project,
          path: `/${path}/$withParam.tsx`,
          nameAndDirectoryFormat,
          style: 'css',
          loader: true,
          action: true,
          meta: true,
          skipChecks: false,
        });

        const content = tree
          .read('apps/demo/app/routes/path/to/example/$withParam.tsx')
          .toString();
        expect(content).toMatch(`function ${componentName}(`);
      });

      it('should error if it detects a possible missing route param because of un-escaped dollar sign', async () => {
        await applicationGenerator(tree, { name: 'demo' });

        expect.assertions(3);

        await routeGenerator(tree, {
          project,
          path: `${path}/route1/.tsx`, // route.$withParams.tsx => route..tsx
          nameAndDirectoryFormat,
          style: 'css',
          loader: true,
          action: true,
          meta: true,
          skipChecks: false,
        }).catch((e) => expect(e).toMatchSnapshot());

        await routeGenerator(tree, {
          project,
          path: `${path}/route2//index.tsx`, // route/$withParams/index.tsx => route//index.tsx
          nameAndDirectoryFormat,
          style: 'css',
          loader: true,
          action: true,
          meta: true,
          skipChecks: false,
        }).catch((e) => expect(e).toMatchSnapshot());

        await routeGenerator(tree, {
          project: 'demo',
          path: `${path}/route3/.tsx`, // route/$withParams.tsx => route/.tsx
          nameAndDirectoryFormat,
          style: 'css',
          loader: true,
          action: true,
          meta: true,
          skipChecks: false,
        }).catch((e) => expect(e).toMatchSnapshot());
      });

      it('should succeed if skipChecks flag is passed, and it detects a possible missing route param because of un-escaped dollar sign', async () => {
        await applicationGenerator(tree, { name: 'demo' });

        await routeGenerator(tree, {
          project,
          path: `${path}/route1/..tsx`, // route.$withParams.tsx => route..tsx
          nameAndDirectoryFormat,
          style: 'css',
          loader: true,
          action: true,
          meta: true,
          skipChecks: true,
        });

        expect(
          tree.exists('apps/demo/app/routes/path/to/example/route1/..tsx')
        ).toBe(true);

        await routeGenerator(tree, {
          project,
          path: `${path}/route2//index.tsx`, // route/$withParams/index.tsx => route//index.tsx
          nameAndDirectoryFormat,
          style: 'css',
          loader: true,
          action: true,
          meta: true,
          skipChecks: true,
        });

        expect(
          tree.exists('apps/demo/app/routes/path/to/example/route2/index.tsx')
        ).toBe(true);

        await routeGenerator(tree, {
          project,
          path: `${path}/route3/.tsx`, // route/$withParams.tsx => route/.tsx
          nameAndDirectoryFormat,
          style: 'css',
          loader: true,
          action: true,
          meta: true,
          skipChecks: true,
        });

        expect(
          tree.exists('apps/demo/app/routes/path/to/example/route3/.tsx')
        ).toBe(true);
      }, 120000);

      if (nameAndDirectoryFormat === 'derived') {
        it('should place routes correctly when app dir is changed', async () => {
          await applicationGenerator(tree, { name: 'demo' });

          tree.write(
            'apps/demo/remix.config.js',
            `
    /**
     * @type {import('@remix-run/dev').AppConfig}
     */
    module.exports = {
      ignoredRouteFiles: ["**/.*"],
      appDirectory: "my-custom-dir",
    };`
          );
          (remixConfigUtils.getRemixConfigValues as jest.Mock) = jest.fn(() =>
            Promise.resolve({
              ignoredRouteFiles: ['**/.*'],
              appDirectory: 'my-custom-dir',
            })
          );

          await routeGenerator(tree, {
            project: 'demo',
            path: 'route.tsx',
            nameAndDirectoryFormat,
            style: 'css',
            loader: true,
            action: true,
            meta: true,
            skipChecks: false,
          });

          expect(tree.exists('apps/demo/my-custom-dir/routes/route.tsx')).toBe(
            true
          );
          expect(tree.exists('apps/demo/my-custom-dir/styles/route.css')).toBe(
            true
          );
        });
      }

      it('should place the route correctly in a standalone app', async () => {
        await presetGenerator(tree, { name: 'demo' });

        await routeGenerator(tree, {
          project,
          path: `${standalonePath}/route.tsx`,
          nameAndDirectoryFormat,
          style: 'none',
          loader: true,
          action: true,
          meta: true,
          skipChecks: false,
        });

        expect(tree.exists('app/routes/route.tsx')).toBe(true);
      });
    }
  );
});
