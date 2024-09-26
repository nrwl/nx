import 'nx/src/internal-testing-utils/mock-project-graph';

jest.mock('../../utils/remix-config');
import * as remixConfigUtils from '../../utils/remix-config';

import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { dirname } from 'path';
import applicationGenerator from '../application/application.impl';
import resourceRouteGenerator from './resource-route.impl';

describe('resource route', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    tree.write('.gitignore', `/node_modules/dist`);

    (remixConfigUtils.getRemixConfigValues as jest.Mock) = jest.fn(() =>
      Promise.resolve({
        ignoredRouteFiles: ['**/.*'],
      })
    );

    await applicationGenerator(tree, { name: 'demo', directory: 'apps/demo' });
  });

  it('should throw an error if loader and action are both false', async () => {
    await expect(
      async () =>
        await resourceRouteGenerator(tree, {
          path: 'apps/demo/app/routes/example.ts',
          action: false,
          loader: false,
          skipChecks: false,
        })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"The resource route generator requires either \`loader\` or \`action\` to be true"`
    );
  });

  describe.each([['as-provided', 'apps/demo/app/routes/example.ts', '']])(
    '--nameAndDirectoryFormat=%s',
    (nameAndDirectoryFormat, path: string) => {
      it(`should create correct file for path ${path}`, async () => {
        await resourceRouteGenerator(tree, {
          path,
          action: false,
          loader: true,
          skipChecks: false,
        });

        expect(tree.exists('apps/demo/app/routes/example.ts')).toBeTruthy();
      });

      it('should error if it detects a possible missing route param because of un-escaped dollar sign', async () => {
        expect.assertions(3);

        await resourceRouteGenerator(tree, {
          path: `${dirname(path)}/route1/.ts`, // route.$withParams.tsx => route..tsx
          loader: true,
          action: true,
          skipChecks: false,
        }).catch((e) => expect(e).toMatchSnapshot());

        await resourceRouteGenerator(tree, {
          path: `${dirname(path)}/route2//index.ts`, // route/$withParams/index.tsx => route//index.tsx
          loader: true,
          action: true,
          skipChecks: false,
        }).catch((e) =>
          expect(e).toMatchInlineSnapshot(
            `[Error: Your route path has an indicator of an un-escaped dollar sign for a route param. If this was intended, include the --skipChecks flag.]`
          )
        );

        await resourceRouteGenerator(tree, {
          path: `${dirname(path)}/route3/.ts`, // route/$withParams.tsx => route/.tsx
          loader: true,
          action: true,
          skipChecks: false,
        }).catch((e) => expect(e).toMatchSnapshot());
      });

      it(`should succeed if skipChecks flag is passed, and it detects a possible missing route param because of un-escaped dollar sign for ${path}`, async () => {
        const basePath =
          nameAndDirectoryFormat === 'as-provided'
            ? ''
            : 'apps/demo/app/routes';
        const normalizedPath = (
          dirname(path) === '' ? '' : `${dirname(path)}/`
        ).replace(basePath, '');
        await resourceRouteGenerator(tree, {
          path: `${normalizedPath}route1/..ts`, // route.$withParams.tsx => route..tsx
          loader: true,
          action: true,
          skipChecks: true,
        });

        expect(tree.exists(`${basePath}/${normalizedPath}route1/..ts`)).toBe(
          true
        );

        await resourceRouteGenerator(tree, {
          path: `${normalizedPath}route2//index.ts`, // route/$withParams/index.tsx => route//index.tsx
          loader: true,
          action: true,
          skipChecks: true,
        });

        expect(
          tree.exists(`${basePath}/${normalizedPath}route2/index.ts`)
        ).toBe(true);

        await resourceRouteGenerator(tree, {
          path: `${normalizedPath}route3/.ts`, // route/$withParams.tsx => route/.tsx
          loader: true,
          action: true,
          skipChecks: true,
        });

        expect(tree.exists(`${basePath}/${normalizedPath}route3/.ts`)).toBe(
          true
        );
      });
    }
  );
});
