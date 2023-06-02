import * as fs from 'fs';

import * as configModule from '../../../config/configuration';
import { DependencyType, ProjectGraph } from '../../../config/project-graph';
import * as hashModule from '../../../hasher/task-hasher';
import { createPackageJson } from './create-package-json';
import * as fileutilsModule from '../../../utils/fileutils';

jest.mock('../../../utils/workspace-root', () => ({
  workspaceRoot: '/root',
}));

describe('createPackageJson', () => {
  it('should create a package.json', () => {});
});

// describe('createPackageJson', () => {
//   it('should add additional dependencies', () => {
//     jest.spyOn(fs, 'existsSync').mockReturnValue(false);
//     jest.spyOn(fileutilsModule, 'readJsonFile').mockReturnValue({
//       dependencies: {
//         typescript: '4.8.4',
//         tslib: '2.4.0',
//       },
//     });
//
//     expect(
//       createPackageJson(
//         'lib1',
//         {
//           nodes: {
//             lib1: {
//               type: 'lib',
//               name: 'lib1',
//               data: { files: [], targets: {}, root: '' },
//             },
//           },
//           externalNodes: {
//             'npm:tslib': {
//               type: 'npm',
//               name: 'npm:tslib',
//               data: { version: '2.4.0', hash: '', packageName: 'tslib' },
//             },
//           },
//           dependencies: {},
//         },
//         { helperDependencies: ['npm:tslib'] }
//       )
//     ).toEqual({
//       dependencies: {
//         tslib: '2.4.0',
//       },
//       name: 'lib1',
//       version: '0.0.1',
//     });
//   });
//
//   it('should only add file dependencies if target is specified', () => {
//     jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({
//       namedInputs: {
//         default: ['{projectRoot}/**/*'],
//         production: ['!{projectRoot}/**/*.spec.ts'],
//       },
//       targetDefaults: {
//         build: {
//           inputs: ['default', 'production', '^production'],
//         },
//       },
//     });
//
//     jest.spyOn(fs, 'existsSync').mockReturnValue(false);
//     jest.spyOn(fileutilsModule, 'readJsonFile').mockReturnValue({
//       dependencies: {
//         axios: '1.0.0',
//         tslib: '2.4.0',
//         jest: '29.0.0',
//         typescript: '4.8.4',
//       },
//     });
//
//     expect(
//       createPackageJson(
//         'lib1',
//         {
//           nodes: {
//             lib1: {
//               type: 'lib',
//               name: 'lib1',
//               data: {
//                 root: 'libs/lib1',
//                 targets: {
//                   build: {},
//                 },
//                 files: [
//                   {
//                     file: 'libs/lib1/src/main.ts',
//                     dependencies: [
//                       {
//                         type: DependencyType.static,
//                         target: 'npm:typescript',
//                         source: 'lib1',
//                       },
//                     ],
//                     hash: '',
//                   },
//                   {
//                     file: 'libs/lib1/src/main2.ts',
//                     dependencies: [
//                       {
//                         type: DependencyType.static,
//                         target: 'lib2',
//                         source: 'lib1',
//                       },
//                     ],
//                     hash: '',
//                   },
//                   {
//                     file: 'libs/lib1/src/main.spec.ts',
//                     dependencies: [
//                       {
//                         type: DependencyType.static,
//                         target: 'npm:jest',
//                         source: 'lib1',
//                       },
//                     ],
//                     hash: '',
//                   },
//                 ],
//               },
//             },
//             lib2: {
//               type: 'lib',
//               name: 'lib2',
//               data: {
//                 root: 'libs/lib2',
//                 targets: {
//                   build: {},
//                 },
//                 files: [
//                   {
//                     file: 'libs/lib2/src/main.ts',
//                     dependencies: [
//                       {
//                         type: DependencyType.static,
//                         target: 'npm:axios',
//                         source: 'lib2',
//                       },
//                     ],
//                     hash: '',
//                   },
//                   {
//                     file: 'libs/lib2/src/main.spec.ts',
//                     dependencies: [
//                       {
//                         type: DependencyType.static,
//                         target: 'npm:jest',
//                         source: 'lib2',
//                       },
//                     ],
//                     hash: '',
//                   },
//                 ],
//               },
//             },
//           },
//           externalNodes: {
//             'npm:tslib': {
//               type: 'npm',
//               name: 'npm:tslib',
//               data: { version: '2.4.0', hash: '', packageName: 'tslib' },
//             },
//             'npm:typescript': {
//               type: 'npm',
//               name: 'npm:typescript',
//               data: { version: '4.8.4', hash: '', packageName: 'typescript' },
//             },
//             'npm:jest': {
//               type: 'npm',
//               name: 'npm:jest',
//               data: { version: '29.0.0', hash: '', packageName: 'jest' },
//             },
//             'npm:axios': {
//               type: 'npm',
//               name: 'npm:jest',
//               data: { version: '1.0.0', hash: '', packageName: 'axios' },
//             },
//           },
//           dependencies: {},
//         },
//         {
//           target: 'build',
//           isProduction: true,
//           helperDependencies: ['npm:tslib'],
//         }
//       )
//     ).toEqual({
//       dependencies: {
//         axios: '1.0.0',
//         tslib: '2.4.0',
//         typescript: '4.8.4',
//       },
//       name: 'lib1',
//       version: '0.0.1',
//     });
//   });
//
//   it('should only add all dependencies if target is not specified', () => {
//     jest.spyOn(fs, 'existsSync').mockReturnValue(false);
//     jest.spyOn(fileutilsModule, 'readJsonFile').mockReturnValue({
//       dependencies: {
//         axios: '1.0.0',
//         tslib: '2.4.0',
//         jest: '29.0.0',
//         typescript: '4.8.4',
//       },
//     });
//
//     expect(
//       createPackageJson(
//         'lib1',
//         {
//           nodes: {
//             lib1: {
//               type: 'lib',
//               name: 'lib1',
//               data: {
//                 root: 'libs/lib1',
//                 targets: {
//                   build: {},
//                 },
//                 files: [
//                   {
//                     file: 'libs/lib1/src/main.ts',
//                     dependencies: [
//                       {
//                         type: DependencyType.static,
//                         target: 'npm:typescript',
//                         source: 'lib1',
//                       },
//                     ],
//                     hash: '',
//                   },
//                   {
//                     file: 'libs/lib1/src/main2.ts',
//                     dependencies: [
//                       {
//                         type: DependencyType.static,
//                         target: 'lib2',
//                         source: 'lib1',
//                       },
//                     ],
//                     hash: '',
//                   },
//                   {
//                     file: 'libs/lib1/src/main.spec.ts',
//                     dependencies: [
//                       {
//                         type: DependencyType.static,
//                         target: 'npm:jest',
//                         source: 'lib1',
//                       },
//                     ],
//                     hash: '',
//                   },
//                 ],
//               },
//             },
//             lib2: {
//               type: 'lib',
//               name: 'lib2',
//               data: {
//                 root: 'libs/lib2',
//                 targets: {
//                   build: {},
//                 },
//                 files: [
//                   {
//                     file: 'libs/lib2/src/main.ts',
//                     dependencies: [
//                       {
//                         type: DependencyType.static,
//                         target: 'npm:axios',
//                         source: 'lib2',
//                       },
//                     ],
//                     hash: '',
//                   },
//                   {
//                     file: 'libs/lib2/src/main.spec.ts',
//                     dependencies: [
//                       {
//                         type: DependencyType.static,
//                         target: 'npm:jest',
//                         source: 'lib2',
//                       },
//                     ],
//                     hash: '',
//                   },
//                 ],
//               },
//             },
//           },
//           externalNodes: {
//             'npm:tslib': {
//               type: 'npm',
//               name: 'npm:tslib',
//               data: { version: '2.4.0', hash: '', packageName: 'tslib' },
//             },
//             'npm:typescript': {
//               type: 'npm',
//               name: 'npm:typescript',
//               data: { version: '4.8.4', hash: '', packageName: 'typescript' },
//             },
//             'npm:jest': {
//               type: 'npm',
//               name: 'npm:jest',
//               data: { version: '29.0.0', hash: '', packageName: 'jest' },
//             },
//             'npm:axios': {
//               type: 'npm',
//               name: 'npm:axios',
//               data: { version: '1.0.0', hash: '', packageName: 'axios' },
//             },
//           },
//           dependencies: {},
//         },
//         { isProduction: true, helperDependencies: ['npm:tslib'] }
//       )
//     ).toEqual({
//       dependencies: {
//         axios: '1.0.0',
//         jest: '29.0.0',
//         tslib: '2.4.0',
//         typescript: '4.8.4',
//       },
//       name: 'lib1',
//       version: '0.0.1',
//     });
//   });
//
//   it('should cache filterUsingGlobPatterns', () => {
//     jest.spyOn(fs, 'existsSync').mockReturnValue(false);
//     jest.spyOn(fileutilsModule, 'readJsonFile').mockReturnValue({
//       dependencies: {
//         axios: '1.0.0',
//         tslib: '2.4.0',
//         jest: '29.0.0',
//         typescript: '4.8.4',
//       },
//     });
//     const filterUsingGlobPatternsSpy = jest.spyOn(
//       hashModule,
//       'filterUsingGlobPatterns'
//     );
//
//     expect(
//       createPackageJson(
//         'lib1',
//         {
//           nodes: {
//             lib1: {
//               type: 'lib',
//               name: 'lib1',
//               data: {
//                 root: 'libs/lib1',
//                 targets: {
//                   build: {},
//                 },
//                 files: [
//                   {
//                     file: 'libs/lib1/src/main.ts',
//                     dependencies: [
//                       {
//                         type: DependencyType.static,
//                         target: 'lib3',
//                         source: 'lib1',
//                       },
//                     ],
//                     hash: '',
//                   },
//                   {
//                     file: 'libs/lib1/src/main2.ts',
//                     dependencies: [
//                       {
//                         type: DependencyType.static,
//                         target: 'lib2',
//                         source: 'lib1',
//                       },
//                     ],
//                     hash: '',
//                   },
//                 ],
//               },
//             },
//             lib2: {
//               type: 'lib',
//               name: 'lib2',
//               data: {
//                 root: 'libs/lib2',
//                 targets: {
//                   build: {},
//                 },
//                 files: [
//                   {
//                     file: 'libs/lib2/src/main.ts',
//                     dependencies: [
//                       {
//                         type: DependencyType.static,
//                         target: 'lib4',
//                         source: 'lib2',
//                       },
//                     ],
//                     hash: '',
//                   },
//                 ],
//               },
//             },
//             lib3: {
//               type: 'lib',
//               name: 'lib3',
//               data: {
//                 root: 'libs/lib3',
//                 targets: {
//                   build: {},
//                 },
//                 files: [
//                   {
//                     file: 'libs/lib3/src/main.ts',
//                     dependencies: [
//                       {
//                         type: DependencyType.static,
//                         target: 'lib4',
//                         source: 'lib3',
//                       },
//                     ],
//                     hash: '',
//                   },
//                 ],
//               },
//             },
//             lib4: {
//               type: 'lib',
//               name: 'lib4',
//               data: {
//                 root: 'libs/lib4',
//                 targets: {
//                   build: {},
//                 },
//                 files: [
//                   {
//                     file: 'libs/lib2/src/main.ts',
//                     dependencies: [
//                       {
//                         type: DependencyType.static,
//                         target: 'npm:axios',
//                         source: 'lib2',
//                       },
//                     ],
//                     hash: '',
//                   },
//                 ],
//               },
//             },
//           },
//           externalNodes: {
//             'npm:axios': {
//               type: 'npm',
//               name: 'npm:axios',
//               data: { version: '1.0.0', hash: '', packageName: 'axios' },
//             },
//           },
//           dependencies: {},
//         },
//         { isProduction: true }
//       )
//     ).toEqual({
//       dependencies: {
//         axios: '1.0.0',
//       },
//       name: 'lib1',
//       version: '0.0.1',
//     });
//
//     expect(filterUsingGlobPatternsSpy).toHaveBeenNthCalledWith(
//       1,
//       'libs/lib1',
//       expect.anything(),
//       expect.anything()
//     );
//     expect(filterUsingGlobPatternsSpy).toHaveBeenNthCalledWith(
//       2,
//       'libs/lib3',
//       expect.anything(),
//       expect.anything()
//     );
//     expect(filterUsingGlobPatternsSpy).toHaveBeenNthCalledWith(
//       3,
//       'libs/lib4',
//       expect.anything(),
//       expect.anything()
//     );
//     expect(filterUsingGlobPatternsSpy).toHaveBeenNthCalledWith(
//       4,
//       'libs/lib2',
//       expect.anything(),
//       expect.anything()
//     );
//     expect(filterUsingGlobPatternsSpy).toHaveBeenCalledTimes(4);
//   });
//
//   describe('parsing "package.json" versions', () => {
//     const appDependencies = [
//       { source: 'app1', target: 'npm:@nx/devkit', type: 'static' },
//       { source: 'app1', target: 'npm:typescript', type: 'static' },
//     ];
//
//     const libDependencies = [
//       { source: 'lib1', target: 'npm:@nx/devkit', type: 'static' },
//       { source: 'lib1', target: 'npm:tslib', type: 'static' },
//       { source: 'lib1', target: 'npm:typescript', type: 'static' },
//     ];
//
//     const graph: ProjectGraph = {
//       nodes: {
//         app1: {
//           type: 'app',
//           name: 'app1',
//           data: {
//             files: [
//               {
//                 file: '/root/apps/app1/src/main.ts',
//                 hash: '',
//                 dependencies: appDependencies,
//               },
//             ],
//             targets: {},
//             root: '/root/apps/app1',
//           },
//         },
//         lib1: {
//           type: 'lib',
//           name: 'lib1',
//           data: {
//             files: [
//               {
//                 file: '/root/libs/lib1/index.ts',
//                 hash: '',
//                 dependencies: libDependencies,
//               },
//             ],
//             targets: {},
//             root: '/root/libs/lib1',
//           },
//         },
//       },
//       externalNodes: {
//         'npm:@nx/devkit': {
//           type: 'npm',
//           name: 'npm:@nx/devkit',
//           data: { version: '16.0.0', hash: '', packageName: '@nx/devkit' },
//         },
//         'npm:nx': {
//           type: 'npm',
//           name: 'npm:nx',
//           data: { version: '16.0.0', hash: '', packageName: 'nx' },
//         },
//         'npm:tslib': {
//           type: 'npm',
//           name: 'npm:tslib',
//           data: { version: '2.4.4', hash: '', packageName: 'tslib' },
//         },
//         'npm:typescript': {
//           type: 'npm',
//           name: 'npm:typescript',
//           data: { version: '4.9.5', hash: '', packageName: 'typescript' },
//         },
//       },
//       dependencies: {
//         app1: appDependencies,
//         lib1: libDependencies,
//       },
//     };
//
//     const rootPackageJson = () => ({
//       dependencies: {
//         '@nx/devkit': '~16.0.0',
//         nx: '> 14',
//         typescript: '^4.8.2',
//         tslib: '~2.4.0',
//       },
//     });
//
//     const projectPackageJson = () => ({
//       name: 'other-name',
//       version: '1.2.3',
//       dependencies: {
//         typescript: '^4.8.4',
//         random: '1.0.0',
//       },
//     });
//
//     const spies = [];
//
//     afterEach(() => {
//       while (spies.length > 0) {
//         spies.pop().mockRestore();
//       }
//     });
//
//     it('should use fixed versions when creating package json for apps', () => {
//       spies.push(
//         jest
//           .spyOn(fileutilsModule, 'readJsonFile')
//           .mockImplementation((path) => {
//             if (path === '/root/package.json') {
//               return rootPackageJson();
//             }
//           })
//       );
//
//       expect(createPackageJson('app1', graph)).toEqual({
//         dependencies: {
//           '@nx/devkit': '16.0.0',
//           nx: '16.0.0',
//           typescript: '4.9.5',
//         },
//         name: 'app1',
//         version: '0.0.1',
//       });
//     });
//
//     it('should override fixed versions with local ranges when creating package json for apps', () => {
//       spies.push(
//         jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
//           if (path === '/root/apps/app1/package.json') {
//             return true;
//           }
//         })
//       );
//       spies.push(
//         jest
//           .spyOn(fileutilsModule, 'readJsonFile')
//           .mockImplementation((path) => {
//             if (path === '/root/package.json') {
//               return rootPackageJson();
//             }
//             if (path === '/root/apps/app1/package.json') {
//               return projectPackageJson();
//             }
//           })
//       );
//
//       expect(createPackageJson('app1', graph)).toEqual({
//         dependencies: {
//           '@nx/devkit': '16.0.0',
//           nx: '16.0.0',
//           random: '1.0.0',
//           typescript: '^4.8.4',
//         },
//         name: 'other-name',
//         version: '1.2.3',
//       });
//     });
//
//     it('should use range versions when creating package json for libs', () => {
//       spies.push(
//         jest
//           .spyOn(fileutilsModule, 'readJsonFile')
//           .mockImplementation((path) => {
//             if (path === '/root/package.json') {
//               return rootPackageJson();
//             }
//           })
//       );
//
//       expect(createPackageJson('lib1', graph)).toEqual({
//         dependencies: {
//           '@nx/devkit': '~16.0.0',
//           tslib: '~2.4.0',
//           typescript: '^4.8.2',
//         },
//         name: 'lib1',
//         version: '0.0.1',
//       });
//     });
//
//     it('should override range versions with local ranges when creating package json for libs', () => {
//       spies.push(
//         jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
//           if (path === '/root/libs/lib1/package.json') {
//             return true;
//           }
//         })
//       );
//       spies.push(
//         jest
//           .spyOn(fileutilsModule, 'readJsonFile')
//           .mockImplementation((path) => {
//             if (path === '/root/package.json') {
//               return rootPackageJson();
//             }
//             if (path === '/root/libs/lib1/package.json') {
//               return projectPackageJson();
//             }
//           })
//       );
//
//       expect(createPackageJson('lib1', graph)).toEqual({
//         dependencies: {
//           '@nx/devkit': '~16.0.0',
//           random: '1.0.0',
//           tslib: '~2.4.0',
//           typescript: '^4.8.4',
//         },
//         name: 'other-name',
//         version: '1.2.3',
//       });
//     });
//   });
// });
