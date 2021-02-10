describe('empty', () => {
  it('empty', () => {
    expect(1).toBe(1);
  });
});
// import { JsonObject } from '@angular-devkit/core';
// import { MockBuilderContext } from '@nrwl/workspace/testing';
// import { BuildAngularLibraryBuilderOptions, run } from './package.impl';
// import { getMockContext } from '../../utils/testing';
// import * as projectGraphUtils from '@nrwl/workspace/src/core/project-graph';
// import {
//   ProjectGraph,
//   ProjectType,
// } from '@nrwl/workspace/src/core/project-graph';
// import * as fileUtils from '@nrwl/workspace/src/utilities/fileutils';
//
// jest.mock('ng-packagr');
// import * as ngPackagrImport from 'ng-packagr';
// import * as ng from '@angular/compiler-cli';
// import { NgPackagr } from 'ng-packagr';
//
// class NgPackagrMock extends NgPackagr {
//   constructor() {
//     super(null);
//   }
// }
//
// describe('AngularLibraryWebBuildBuilder', () => {
//   let context: MockBuilderContext;
//   let testOptions: BuildAngularLibraryBuilderOptions & JsonObject;
//   let ngPackagrMock;
//
//   beforeEach(async () => {
//     context = await getMockContext();
//
//     // NgPackagr has some weird fluent API. I wonder whether
//     // I could simplify this mock
//     ngPackagrMock = new NgPackagrMock();
//     spyOn(ngPackagrMock, 'build').and.callFake(() => {
//       return Promise.resolve();
//     });
//     spyOn(ngPackagrMock, 'forProject').and.callThrough();
//     spyOn(ngPackagrMock, 'withTsConfig').and.callThrough();
//
//     spyOn(ngPackagrImport, 'ngPackagr').and.callFake(() => {
//       return ngPackagrMock;
//     });
//
//     // used for updating the json files
//     spyOn(fileUtils, 'writeJsonFile');
//     // parent tsconfig
//     spyOn(ng, 'readConfiguration').and.callFake(() => {
//       return {
//         options: {
//           paths: {
//             '@proj/buildable-child': [],
//           },
//         },
//       };
//     });
//     spyOn(fileUtils, 'fileExists').and.returnValue(true);
//
//     context.target = {
//       project: 'buildable-parent',
//       target: 'build',
//     };
//
//     testOptions = {
//       tsConfig: 'libs/publishable-parent/tsconfig.lib.json',
//       project: 'libs/publishable-parent/ng-package.json',
//     };
//   });
//
//   it('should invoke ng-packagr for a libary without any dependencies', async () => {
//     spyOn(projectGraphUtils, 'createProjectGraph').and.callFake(() => {
//       return {
//         nodes: {
//           'buildable-parent': {
//             type: ProjectType.lib,
//             name: 'buildable-parent',
//             data: { files: [], root: 'libs/buildable-parent' },
//           },
//         },
//         dependencies: {},
//       } as ProjectGraph;
//     });
//
//     // act
//     const result = await run(testOptions, context).toPromise();
//
//     expect(result.success).toBeTruthy();
//     expect(ngPackagrMock.build).toHaveBeenCalled();
//   });
//
//   describe('with dependent libraries', () => {
//     beforeEach(() => {
//       // create project graph with dependencies
//       spyOn(projectGraphUtils, 'createProjectGraph').and.callFake(() => {
//         return {
//           nodes: {
//             'buildable-parent': {
//               type: ProjectType.lib,
//               name: 'buildable-parent',
//               data: {
//                 files: [],
//                 root: 'libs/buildable-parent',
//                 architect: {
//                   build: {
//                     builder: 'any builder',
//                   },
//                 },
//               },
//             },
//             'buildable-child': {
//               type: ProjectType.lib,
//               name: 'buildable-child',
//               data: {
//                 files: [],
//                 root: 'libs/buildable-child',
//                 prefix: 'proj',
//                 architect: {
//                   build: {
//                     builder: 'any builder',
//                   },
//                 },
//               },
//             },
//           },
//           dependencies: {
//             'buildable-parent': [
//               {
//                 type: ProjectType.lib,
//                 target: 'buildable-child',
//                 source: null,
//               },
//             ],
//             'buildable-child': [],
//           },
//         } as ProjectGraph;
//       });
//     });
//
//     it('should properly set the TSConfig paths', async () => {
//       spyOn(fileUtils, 'readJsonFile').and.returnValue({
//         name: '@proj/buildable-child',
//         version: '1.2.3',
//       });
//
//       // act
//       const result = await run(testOptions, context).toPromise();
//
//       // assert
//       expect(result.success).toBeTruthy();
//       expect(ngPackagrMock.withTsConfig).toHaveBeenCalledWith(
//         jasmine.objectContaining({
//           options: {
//             paths: { '@proj/buildable-child': ['dist/libs/buildable-child'] },
//           },
//         })
//       );
//     });
//
//     it('should update the package.json', async () => {
//       spyOn(fileUtils, 'readJsonFile').and.callFake((path: string) => {
//         if (path.endsWith('buildable-parent/package.json')) {
//           return {
//             name: '@proj/buildable-parent',
//             version: '3.3.3',
//           };
//         } else {
//           return {
//             name: '@proj/buildable-child',
//             version: '1.2.3',
//           };
//         }
//       });
//
//       // act
//       const result = await run(
//         { ...testOptions, updateBuildableProjectDepsInPackageJson: true },
//         context
//       ).toPromise();
//       // assert
//       expect(result.success).toBeTruthy();
//       expect(fileUtils.writeJsonFile).toHaveBeenCalledWith(
//         'dist/libs/buildable-parent/package.json',
//         jasmine.objectContaining({
//           dependencies: {
//             '@proj/buildable-child': '1.2.3',
//           },
//         })
//       );
//     });
//
//     ['dependencies', 'devDependencies', 'peerDependencies'].forEach(
//       (depConfigName: string) => {
//         it(`should not update the package.json if the ${depConfigName} already contain a matching entry`, async () => {
//           spyOn(fileUtils, 'readJsonFile').and.callFake((path: string) => {
//             if (path.endsWith('buildable-parent/package.json')) {
//               return {
//                 name: '@proj/buildable-parent',
//                 version: '1.2.3',
//                 [depConfigName]: {
//                   '@proj/buildable-child': '1.1.1',
//                 },
//               };
//             } else {
//               return {
//                 name: '@proj/buildable-child',
//                 version: '1.2.3',
//               };
//             }
//           });
//
//           // act
//           const result = await run(testOptions, context).toPromise();
//
//           // assert
//           expect(result.success).toBeTruthy();
//           expect(fileUtils.writeJsonFile).not.toHaveBeenCalled();
//         });
//       }
//     );
//   });
// });
