import '../../../../internal-testing-utils/mock-fs';

import { vol } from 'memfs';
import { join } from 'node:path';
import {
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
} from '../../../../config/project-graph';
import {
  TargetProjectLocator,
  isBuiltinModuleImport,
} from './target-project-locator';

import { builtinModules } from 'node:module';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  workspaceRoot: '/root',
}));

jest.mock('nx/src/utils/workspace-root', () => ({
  workspaceRoot: '/root',
}));

jest.mock('nx/src/plugins/js/utils/resolve-relative-to-dir', () => ({
  resolveRelativeToDir: jest.fn().mockImplementation((pathOrPackage) => {
    // We intentionally don't want to find this package on disk to test fallback behavior
    if (pathOrPackage.startsWith('@nx/nx-win32-x64-msvc')) {
      return null;
    }
    // We intentionally don't allow access to the package.json (emulating package exports)
    // return the dist/cjs/package.json file to emulate node's behavior for multi module format packages
    if (pathOrPackage === 'minimatch/package.json') {
      return null;
    }
    if (pathOrPackage === 'minimatch') {
      return '/root/node_modules/minimatch/dist/cjs/package.json';
    }
    if (pathOrPackage === '@json2csv/plainjs/package.json') {
      return '/root/node_modules/@json2csv/plainjs/dist/cjs/package.json';
    }
    return join(
      '/root',
      'node_modules',
      pathOrPackage,
      pathOrPackage.endsWith('package.json') ? '' : 'package.json'
    );
  }),
}));

describe('TargetProjectLocator', () => {
  describe('findTargetProjectWithImport', () => {
    let projects: Record<string, ProjectGraphProjectNode>;
    let npmProjects: Record<string, ProjectGraphExternalNode>;
    let fsJson: Record<string, string>;
    let targetProjectLocator: TargetProjectLocator;

    beforeEach(() => {
      const nxJson = {
        npmScope: 'proj',
      };
      const tsConfig = {
        compilerOptions: {
          baseUrl: '.',
          resolveJsonModule: true,
          paths: {
            '@proj/proj': ['libs/proj'],
            '@proj/my-second-proj': ['libs/proj2'],
            '@proj/my-second-proj/*': ['libs/proj2/*'],
            '@proj/project-3': ['libs/proj3a'],
            '@proj/proj4ab': ['libs/proj4ab'],
            '@proj/proj5': ['./libs/proj5/*'],
            '@proj/proj6': ['../root/libs/proj6/*'],
            '@proj/proj7': ['/libs/proj7/*'],
            '@proj/proj123': ['libs/proj123'],
            '@proj/proj123/*': ['libs/proj123/*'],
            '@proj/proj1234': ['libs/proj1234'],
            '@proj/proj1234/*': ['libs/proj1234/*'],
            '@proj/proj1234-child': ['libs/proj1234-child'],
            '@proj/proj1234-child/*': ['libs/proj1234-child/*'],
            '#hash-path': ['libs/hash-project/src/index.ts'],
            'parent-path/*': ['libs/parent-path/*'],
          },
        },
      };
      fsJson = {
        './nx.json': JSON.stringify(nxJson),
        './tsconfig.base.json': JSON.stringify(tsConfig),
        './node_modules/@ng/core/package.json': JSON.stringify({
          name: '@ng/core',
          version: '1.0.0',
        }),
        './node_modules/npm-package/package.json': JSON.stringify({
          name: 'npm-package',
          version: '1.0.0',
        }),
        './node_modules/@proj/proj123-base/package.json': JSON.stringify({
          name: '@proj/proj123-base',
          version: '1.0.0',
        }),
        './node_modules/lodash/package.json': JSON.stringify({
          name: 'lodash',
          version: '3.0.0',
        }),
        './node_modules/lodash-4/package.json': JSON.stringify({
          name: 'lodash',
          version: '4.0.0',
        }),
      };
      vol.fromJSON(fsJson, '/root');
      projects = {
        rootProj: {
          name: 'rootProj',
          type: 'lib',
          data: {
            root: '.',
          },
        },
        proj3a: {
          name: 'proj3a',
          type: 'lib',
          data: {
            root: 'libs/proj3a',
          },
        },
        proj2: {
          name: 'proj2',
          type: 'lib',
          data: {
            root: 'libs/proj2',
          },
        },
        proj: {
          name: 'proj',
          type: 'lib',
          data: {
            root: 'libs/proj',
          },
        },
        proj1234: {
          name: 'proj1234',
          type: 'lib',
          data: {
            root: 'libs/proj1234',
          },
        },
        proj123: {
          name: 'proj123',
          type: 'lib',
          data: {
            root: 'libs/proj123',
          },
        },
        proj4ab: {
          name: 'proj4ab',
          type: 'lib',
          data: {
            root: 'libs/proj4ab',
          },
        },
        proj5: {
          name: 'proj5',
          type: 'lib',
          data: {
            root: 'libs/proj5',
          },
        },
        proj6: {
          name: 'proj6',
          type: 'lib',
          data: {
            root: 'libs/proj6',
          },
        },
        proj7: {
          name: 'proj7',
          type: 'lib',
          data: {
            root: 'libs/proj7',
          },
        },
        'proj1234-child': {
          name: 'proj1234-child',
          type: 'lib',
          data: {
            root: 'libs/proj1234-child',
          },
        },
        'hash-project': {
          name: 'hash-project',
          type: 'lib',
          data: {
            root: 'libs/hash-project',
          },
        },
        'parent-project': {
          name: 'parent-project',
          type: 'lib',
          data: {
            root: 'libs/parent-path',
          },
        },
        'child-project': {
          name: 'child-project',
          type: 'lib',
          data: {
            root: 'libs/parent-path/child-path',
          },
        },
      };
      npmProjects = {
        'npm:@ng/core': {
          name: 'npm:@ng/core',
          type: 'npm',
          data: {
            version: '1.0.0',
            packageName: '@ng/core',
          },
        },
        'npm:@ng/common': {
          name: 'npm:@ng/common',
          type: 'npm',
          data: {
            version: '1.0.0',
            packageName: '@ng/common',
          },
        },
        'npm:npm-package': {
          name: 'npm:npm-package',
          type: 'npm',
          data: {
            version: '1.0.0',
            packageName: 'npm-package',
          },
        },
        'npm:@proj/my-second-proj': {
          name: 'npm:@proj/my-second-proj',
          type: 'npm',
          data: {
            version: '1.0.0',
            packageName: '@proj/my-second-proj',
          },
        },
        'npm:@proj/proj5': {
          name: 'npm:@proj/proj5',
          type: 'npm',
          data: {
            version: '1.0.0',
            packageName: '@proj/proj5',
          },
        },
        'npm:@proj/proj6': {
          name: 'npm:@proj/proj6',
          type: 'npm',
          data: {
            version: '1.0.0',
            packageName: '@proj/proj6',
          },
        },
        'npm:@proj/proj7': {
          name: 'npm:@proj/proj7',
          type: 'npm',
          data: {
            version: '1.0.0',
            packageName: '@proj/proj7',
          },
        },
        'npm:@proj/proj123-base': {
          name: 'npm:@proj/proj123-base',
          type: 'npm',
          data: {
            version: '1.0.0',
            packageName: '@proj/proj123-base',
          },
        },
        'npm:lodash': {
          name: 'npm:lodash',
          type: 'npm',
          data: {
            version: '3.0.0',
            packageName: 'lodash',
          },
        },
        'npm:lodash-4': {
          name: 'npm:lodash-4',
          type: 'npm',
          data: {
            packageName: 'lodash-4',
            version: 'npm:lodash@4.0.0',
          },
        },
      };

      targetProjectLocator = new TargetProjectLocator(projects, npmProjects);
    });

    it('should be able to resolve a module by using relative paths', () => {
      const res1 = targetProjectLocator.findProjectFromImport(
        './class.ts',
        'libs/proj/index.ts'
      );
      const res2 = targetProjectLocator.findProjectFromImport(
        '../index.ts',
        'libs/proj/src/index.ts'
      );
      const res3 = targetProjectLocator.findProjectFromImport(
        '../proj/../proj2/index.ts',
        'libs/proj/index.ts'
      );
      const res4 = targetProjectLocator.findProjectFromImport(
        '../proj/../index.ts',
        'libs/proj/src/index.ts'
      );
      const res5 = targetProjectLocator.findProjectFromImport(
        '../../../index.ts',
        'libs/proj/src/index.ts'
      );

      expect(res1).toEqual('proj');
      expect(res2).toEqual('proj');
      expect(res3).toEqual('proj2');
      expect(res4).toEqual('proj');
      expect(res5).toEqual('rootProj');
    });

    it('should be able to resolve a module by using tsConfig paths', () => {
      const proj2 = targetProjectLocator.findProjectFromImport(
        '@proj/my-second-proj',
        'libs/proj1/index.ts'
      );
      // const proj3a = targetProjectLocator.findProjectWithImport(
      //   '@proj/project-3',
      //   'libs/proj1/index.ts'
      // );

      expect(proj2).toEqual('proj2');
      // expect(proj3a).toEqual('proj3a');
    });

    it('should be able to resolve nested files using tsConfig paths', () => {
      const proj2deep = targetProjectLocator.findProjectFromImport(
        '@proj/my-second-proj/deep',
        'libs/proj1/index.ts'
      );

      expect(proj2deep).toEqual('proj2');
    });

    it('should be able to resolve nested files using tsConfig paths when having a root tsconfig.json instead of tsconfig.base.json', () => {
      fsJson['./tsconfig.json'] = fsJson['./tsconfig.base.json'];
      delete fsJson['./tsconfig.base.json'];

      const proj2deep = targetProjectLocator.findProjectFromImport(
        '@proj/my-second-proj/deep',
        'libs/proj1/index.ts'
      );

      expect(proj2deep).toEqual('proj2');
    });

    it('should be able to resolve nested files using tsConfig paths that have similar names', () => {
      const proj = targetProjectLocator.findProjectFromImport(
        '@proj/proj123/deep',
        ''
      );
      expect(proj).toEqual('proj123');

      const childProj = targetProjectLocator.findProjectFromImport(
        '@proj/proj1234-child/deep',
        ''
      );
      expect(childProj).toEqual('proj1234-child');

      const parentProj = targetProjectLocator.findProjectFromImport(
        '@proj/proj1234/deep',
        ''
      );
      expect(parentProj).toEqual('proj1234');
    });

    it('should be able to locate npm dependencies', () => {
      const result1 = targetProjectLocator.findProjectFromImport(
        '@ng/core',
        'libs/proj1/index.ts'
      );
      const result2 = targetProjectLocator.findProjectFromImport(
        'npm-package',
        'libs/proj1/index.ts'
      );

      expect(result1).toEqual('npm:@ng/core');
      expect(result2).toEqual('npm:npm-package');
    });

    it('should be able to resolve wildcard paths', () => {
      const parentProject = targetProjectLocator.findProjectFromImport(
        'parent-path',
        'libs/proj1/index.ts'
      );

      expect(parentProject).toEqual('parent-project');

      const childProject = targetProjectLocator.findProjectFromImport(
        'parent-path/child-path',
        'libs/proj1/index.ts'
      );

      expect(childProject).toEqual('child-project');
    });

    it('should be able to resolve paths that start with a #', () => {
      const proj = targetProjectLocator.findProjectFromImport(
        '#hash-path',
        'libs/proj1/index.ts'
      );

      expect(proj).toEqual('hash-project');
    });

    it('should be able to resolve a modules when npm packages exist', () => {
      const proj5 = targetProjectLocator.findProjectFromImport(
        '@proj/proj5',
        'libs/proj1/index.ts'
      );
      // const proj6 = targetProjectLocator.findProjectWithImport(
      //   '@proj/proj6',
      //   'libs/proj1/index.ts'
      // );
      // const proj7 = targetProjectLocator.findProjectWithImport(
      //   '@proj/proj7',
      //   'libs/proj1/index.ts'
      // );

      expect(proj5).toEqual('proj5');
      // expect(proj6).toEqual('proj6');
      // expect(proj7).toEqual('proj7');
    });

    it('should be able to resolve paths that have similar names', () => {
      const proj = targetProjectLocator.findProjectFromImport(
        '@proj/proj123',
        ''
      );
      expect(proj).toEqual('proj123');

      const childProj = targetProjectLocator.findProjectFromImport(
        '@proj/proj1234-child',
        ''
      );
      expect(childProj).toEqual('proj1234-child');

      const parentProj = targetProjectLocator.findProjectFromImport(
        '@proj/proj1234',
        ''
      );
      expect(parentProj).toEqual('proj1234');
    });

    it('should be able to resolve npm projects', () => {
      const similarImportFromNpm = targetProjectLocator.findProjectFromImport(
        '@proj/proj123-base',
        'libs/proj/index.ts'
      );
      expect(similarImportFromNpm).toEqual('npm:@proj/proj123-base');

      const similarDeepImportFromNpm =
        targetProjectLocator.findProjectFromImport(
          '@proj/proj123-base/deep',
          'libs/proj/index.ts'
        );
      expect(similarDeepImportFromNpm).toEqual('npm:@proj/proj123-base');
    });

    // TODO(meeroslav): This should fail if path is missing in tsconfig,
    // but passes because of implicit check for project's prefix
    it('should be able to resolve packages using project prefix', () => {
      const proj5 = targetProjectLocator.findProjectFromImport(
        '@proj/proj5',
        'libs/proj/index.ts'
      );
      expect(proj5).toEqual('proj5');
    });

    it('should be able to resolve packages aliases', () => {
      const lodash = targetProjectLocator.findProjectFromImport(
        'lodash',
        'libs/proj/index.ts'
      );
      expect(lodash).toEqual('npm:lodash');

      const lodash4 = targetProjectLocator.findProjectFromImport(
        'lodash-4',
        'libs/proj/index.ts'
      );
      expect(lodash4).toEqual('npm:lodash-4');
    });
  });

  describe('findTargetProjectWithImport (without tsconfig.json)', () => {
    let projects: Record<string, ProjectGraphProjectNode>;
    let npmProjects: Record<string, ProjectGraphExternalNode>;
    let fsJson: Record<string, string>;
    let targetProjectLocator: TargetProjectLocator;

    beforeEach(() => {
      const projectsConfigurations = {
        projects: {
          proj1: {},
        },
      };
      const nxJson = {
        npmScope: 'proj',
      };
      fsJson = {
        './workspace.json': JSON.stringify(projectsConfigurations),
        './nx.json': JSON.stringify(nxJson),
        './libs/proj/index.ts': `import {a} from '@proj/my-second-proj';
                                  import('@proj/project-3');
                                  const a = { loadChildren: '@proj/proj4ab#a' };
          `,
        './libs/proj2/index.ts': `export const a = 2;`,
        './libs/proj2/deep/index.ts': `export const a = 22;`,
        './libs/proj3a/index.ts': `export const a = 3;`,
        './libs/proj4ab/index.ts': `export const a = 4;`,
        './libs/proj5/index.ts': `export const a = 5;`,
        './libs/proj6/index.ts': `export const a = 6;`,
        './libs/proj7/index.ts': `export const a = 7;`,
        './libs/proj123/index.ts': 'export const a = 123',
        './libs/proj1234/index.ts': 'export const a = 1234',
        './libs/proj1234-child/index.ts': 'export const a = 12345',
        './node_modules/@proj/proj123-base/package.json': JSON.stringify({
          name: '@proj/proj123-base',
          version: '1.0.0',
        }),
        './node_modules/@ng/core/package.json': JSON.stringify({
          name: '@ng/core',
          version: '1.0.0',
        }),
        './node_modules/npm-package/package.json': JSON.stringify({
          name: 'npm-package',
          version: '1.0.0',
        }),
        './node_modules/@trpc/server/package.json': JSON.stringify({
          name: '@trpc/server',
          version: '1.0.0-rc.0+abc123',
        }),
        // minimatch is a real world example of a multi module format package with nested package.json files.
        // node will resolve the dist/cjs/package.json file when using require.resolve('minimatch') in commonjs
        // but we need to traverse up to find the parent package.json containing the name and version.
        './node_modules/minimatch/package.json': JSON.stringify({
          name: 'minimatch',
          description: 'a glob matcher in javascript',
          version: '9.0.3',
        }),
        './node_modules/minimatch/dist/cjs/package.json': JSON.stringify({
          type: 'commonjs',
        }),
        './node_modules/@json2csv/plainjs/package.json': JSON.stringify({
          name: '@json2csv/plainjs',
          description: 'something json to csv',
          version: '7.0.6',
        }),
        './node_modules/@json2csv/plainjs/dist/cjs/package.json':
          JSON.stringify({
            type: 'commonjs',
          }),
      };
      vol.fromJSON(fsJson, '/root');

      projects = {
        '@org/proj1': {
          name: '@org/proj1',
          type: 'lib',
          data: {
            root: 'libs/proj1',
          },
        },
        proj3a: {
          name: 'proj3a',
          type: 'lib',
          data: {
            root: 'libs/proj3a',
          },
        },
        proj2: {
          name: 'proj2',
          type: 'lib',
          data: {
            root: 'libs/proj2',
          },
        },
        proj: {
          name: 'proj',
          type: 'lib',
          data: {
            root: 'libs/proj',
          },
        },
        proj1234: {
          name: 'proj1234',
          type: 'lib',
          data: {
            root: 'libs/proj1234',
          },
        },
        proj123: {
          name: 'proj123',
          type: 'lib',
          data: {
            root: 'libs/proj123',
          },
        },
        proj4ab: {
          name: 'proj4ab',
          type: 'lib',
          data: {
            root: 'libs/proj4ab',
          },
        },
        proj5: {
          name: 'proj5',
          type: 'lib',
          data: {
            root: 'libs/proj5',
          },
        },
        proj6: {
          name: 'proj6',
          type: 'lib',
          data: {
            root: 'libs/proj6',
          },
        },
        proj7: {
          name: 'proj7',
          type: 'lib',
          data: {
            root: 'libs/proj7',
          },
        },
        'proj1234-child': {
          name: 'proj1234-child',
          type: 'lib',
          data: {
            root: 'libs/proj1234-child',
          },
        },
      };
      npmProjects = {
        'npm:@ng/core': {
          name: 'npm:@ng/core',
          type: 'npm',
          data: {
            version: '1.0.0',
            packageName: '@ng/core',
          },
        },
        'npm:@ng/common': {
          name: 'npm:@ng/common',
          type: 'npm',
          data: {
            version: '1.0.0',
            packageName: '@ng/common',
          },
        },
        'npm:npm-package': {
          name: 'npm:npm-package',
          type: 'npm',
          data: {
            version: '1.0.0',
            packageName: 'npm-package',
          },
        },
        'npm:@proj/my-second-proj': {
          name: 'npm:@proj/my-second-proj',
          type: 'npm',
          data: {
            version: '1.0.0',
            packageName: '@proj/my-second-proj',
          },
        },
        'npm:@proj/proj5': {
          name: 'npm:@proj/proj5',
          type: 'npm',
          data: {
            version: '1.0.0',
            packageName: '@proj/proj5',
          },
        },
        'npm:@proj/proj6': {
          name: 'npm:@proj/proj6',
          type: 'npm',
          data: {
            version: '1.0.0',
            packageName: '@proj/proj6',
          },
        },
        'npm:@proj/proj7': {
          name: 'npm:@proj/proj7',
          type: 'npm',
          data: {
            version: '1.0.0',
            packageName: '@proj/proj7',
          },
        },
        'npm:@proj/proj123-base': {
          name: 'npm:@proj/proj123-base',
          type: 'npm',
          data: {
            version: '1.0.0',
            packageName: '@proj/proj123-base',
          },
        },
        /**
         * These @nx/nx-win32-x64-msvc external nodes have intentionally not had their locations on disk
         * mocked so that we can evaluate the fallback behavior of the target project locator.
         *
         * We want to preferentially match the unversioned node out of these two, as it is the root dependency.
         */
        'npm:@nx/nx-win32-x64-msvc@17.1.2': {
          type: 'npm',
          name: 'npm:@nx/nx-win32-x64-msvc@17.1.2',
          data: {
            version: '17.1.2',
            packageName: '@nx/nx-win32-x64-msvc',
            hash: 'sha512-oxKCKunuo4wRusMlNu7PlhBijhtNy7eBZPAWyqUsdfnb+CjY2QncjCguW3fnsG9gHQFCa+y0b1WkSkvJ5G1DiQ==',
          },
        },
        'npm:@nx/nx-win32-x64-msvc': {
          type: 'npm',
          name: 'npm:@nx/nx-win32-x64-msvc',
          data: {
            version: '19.2.0-beta.2',
            packageName: '@nx/nx-win32-x64-msvc',
            hash: 'sha512-ggewenDQWc5azOEM/HI7AREuIHXSPO0STL+ehAG2PvoQPHglCdfLQy904D85ttm9wS7AKdK+d3wqMzSQaj7FsA==',
          },
        },
        'npm:@trpc/server': {
          type: 'npm',
          name: 'npm:@trpc/server',
          data: {
            version: '1.0.0-rc.0',
            packageName: '@trpc/server',
            hash: 'sha512-ggewenDQWc5azOEM/HI7AREuIHXSPO0STL+ehAG2PvoQPHglCdfLQy904D85ttm9wS7AKdK+d3wqMzSQaj7FsA==',
          },
        },
        /**
         * We use minimatch as an example of a multiple module format package.
         */
        'npm:minimatch': {
          type: 'npm',
          name: 'npm:minimatch',
          data: {
            version: '9.0.3',
            packageName: 'minimatch',
            hash: 'sha512-RHiac9mvaRw0x3AYRgDC1CxAP7HTcNrrECeA8YYJeWnpo+2Q5CegtZjaotWTWxDG3UeGA1coE05iH1mPjT/2mg==',
          },
        },
        /**
         * We use @json2csv/plainjs as an example of a package where package.json is rerouted to an improper package.json.
         */
        'npm:@json2csv/plainjs': {
          type: 'npm',
          name: 'npm:@json2csv/plainjs',
          data: {
            version: '7.0.6',
            packageName: '@json2csv/plainjs',
            hash: 'sha512-4Md7RPDCSYpmW1HWIpWBOqCd4vWfIqm53S3e/uzQ62iGi7L3r34fK/8nhOMEe+/eVfCx8+gdSCt1d74SlacQHw==',
          },
        },
      };

      targetProjectLocator = new TargetProjectLocator(projects, npmProjects);
    });

    it('should work without a tsconfig file', () => {
      expect(targetProjectLocator).toBeDefined();
    });

    it('should be able to resolve a module by using relative paths', () => {
      const res1 = targetProjectLocator.findProjectFromImport(
        './class.ts',
        'libs/proj/index.ts'
      );
      const res2 = targetProjectLocator.findProjectFromImport(
        '../index.ts',
        'libs/proj/src/index.ts'
      );
      const res3 = targetProjectLocator.findProjectFromImport(
        '../proj/../proj2/index.ts',
        'libs/proj/index.ts'
      );
      const res4 = targetProjectLocator.findProjectFromImport(
        '../proj/../index.ts',
        'libs/proj/src/index.ts'
      );

      expect(res1).toEqual('proj');
      expect(res2).toEqual('proj');
      expect(res3).toEqual('proj2');
      expect(res4).toEqual('proj');
    });

    it('should be able to resolve local project', () => {
      jest
        .spyOn(targetProjectLocator as any, 'resolveImportWithRequire')
        .mockReturnValue('libs/proj1/index.ts');

      const result1 = targetProjectLocator.findProjectFromImport(
        '@org/proj1',
        'libs/proj1/index.ts'
      );
      expect(result1).toEqual('@org/proj1');

      jest
        .spyOn(targetProjectLocator as any, 'resolveImportWithRequire')
        .mockReturnValue('libs/proj1/some/nested/file.ts');
      const result2 = targetProjectLocator.findProjectFromImport(
        '@org/proj1/some/nested/path',
        'libs/proj1/index.ts'
      );
      expect(result2).toEqual('@org/proj1');
    });

    it('should be able to npm dependencies', () => {
      const result1 = targetProjectLocator.findProjectFromImport(
        '@ng/core',
        'libs/proj1/index.ts'
      );
      const result2 = targetProjectLocator.findProjectFromImport(
        'npm-package',
        'libs/proj1/index.ts'
      );

      expect(result1).toEqual('npm:@ng/core');
      expect(result2).toEqual('npm:npm-package');
    });

    it('should be able to resolve npm projects', () => {
      const similarImportFromNpm = targetProjectLocator.findProjectFromImport(
        '@proj/proj123-base',
        'libs/proj/index.ts'
      );
      expect(similarImportFromNpm).toEqual('npm:@proj/proj123-base');

      const similarDeepImportFromNpm =
        targetProjectLocator.findProjectFromImport(
          '@proj/proj123-base/deep',
          'libs/proj/index.ts'
        );
      expect(similarDeepImportFromNpm).toEqual('npm:@proj/proj123-base');
    });

    it('should be able to resolve npm projects with unclean versions', () => {
      const trpcProject = targetProjectLocator.findProjectFromImport(
        '@trpc/server',
        'libs/proj/index.ts'
      );
      expect(trpcProject).toEqual('npm:@trpc/server');
    });

    it('should return null for native modules', () => {
      const result = targetProjectLocator.findProjectFromImport(
        'path',
        'libs/proj/index.ts'
      );
      expect(result).toEqual(null);
    });

    it('should return null for unresolved paths', () => {
      const result = targetProjectLocator.findProjectFromImport(
        'unresolved-path',
        'libs/proj/index.ts'
      );
      expect(result).toEqual(null);
    });

    it('should fall back to matching external nodes from the graph if they could not be resolved on disk', () => {
      const result = targetProjectLocator.findProjectFromImport(
        '@nx/nx-win32-x64-msvc',
        'libs/proj/index.ts'
      );
      // We don't want to match npm:@nx/nx-win32-x64-msvc@17.1.2 in this fallback case even though it came first
      // in the external nodes list
      expect(result).toEqual('npm:@nx/nx-win32-x64-msvc');
    });

    it('should handle resolving multi module build packages such as minimatch', () => {
      const result = targetProjectLocator.findProjectFromImport(
        'minimatch',
        'libs/proj/index.ts'
      );
      expect(result).toEqual('npm:minimatch');
    });

    it('should handle resolving packages which reroutes package.json', () => {
      const result = targetProjectLocator.findProjectFromImport(
        '@json2csv/plainjs',
        'libs/proj/index.ts'
      );
      expect(result).toEqual('npm:@json2csv/plainjs');
    });
  });

  describe('findNpmProjectFromImport', () => {
    it('should resolve external node when the version does not match its own package.json (i.e. git remote) ', () => {
      const projects = {
        proj: {
          name: 'proj',
          type: 'lib' as const,
          data: {
            root: 'proj',
          },
        },
      };
      const npmProjects = {
        'npm:foo': {
          name: 'npm:foo' as const,
          type: 'npm' as const,
          data: {
            version:
              'git+ssh://git@github.com/example/foo.git#6f4b450fc642abba540535f0755c990b42a16026',
            packageName: 'foo',
          },
        },
      };

      const targetProjectLocator = new TargetProjectLocator(
        projects,
        npmProjects,
        new Map()
      );
      targetProjectLocator['readPackageJson'] = () => ({
        name: 'foo',
        version: '0.0.1',
      });
      const result = targetProjectLocator.findNpmProjectFromImport(
        'lodash',
        'proj/index.ts'
      );

      expect(result).toEqual('npm:foo');
    });

    it('should resolve a specific version of external node', () => {
      const projects = {
        proj: {
          name: 'proj',
          type: 'lib' as const,
          data: {
            root: 'proj',
          },
        },
      };
      const npmProjects = {
        'npm:foo@0.0.1': {
          name: 'npm:foo@0.0.1' as const,
          type: 'npm' as const,
          data: {
            version: '0.0.1',
            packageName: 'foo',
          },
        },
      };

      const targetProjectLocator = new TargetProjectLocator(
        projects,
        npmProjects,
        new Map()
      );
      targetProjectLocator['readPackageJson'] = () => ({
        name: 'foo',
        version: '0.0.1',
      });
      const result = targetProjectLocator.findNpmProjectFromImport(
        'lodash',
        'proj/index.ts'
      );

      expect(result).toEqual('npm:foo@0.0.1');
    });
  });
});

describe('isBuiltinModuleImport()', () => {
  const withExclusions = builtinModules
    .concat(builtinModules.filter((a) => true).map((s) => 'node:' + s))
    .concat(['node:test', 'node:sqlite', 'node:test']);

  it.each(withExclusions)(
    `should return true for %s builtin module`,
    (builtinModule) => {
      expect(isBuiltinModuleImport(builtinModule)).toBe(true);
    }
  );
});
