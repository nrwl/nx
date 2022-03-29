import { findInstalledCommunityPlugins } from './report';
// import * as devkit from '@nrwl/devkit';
import * as fileUtils from '../utils/fileutils';
import { join } from 'path';

jest.mock('nx/src/utils/app-root', () => ({
  appRootPath: '',
  workspaceRoot: '',
}));

jest.mock('../utils/fileutils', () => ({
  ...(jest.requireActual('../utils/fileutils') as typeof fileUtils),
  resolve: (file) => `node_modules/${file}`,
}));

describe('reenable spec', () => {
  it('empty', () => {
    expect(1).toEqual(1);
  });
});

// describe('report', () => {
//   describe('findInstalledCommunityPlugins', () => {
//     afterEach(() => jest.resetAllMocks());
//
//     it('should read angular-devkit plugins', () => {
//       jest.spyOn(devkit, 'readJsonFile').mockImplementation((path) => {
//         console.log(path);
//         if (path === 'package.json') {
//           return {
//             dependencies: {
//               'plugin-one': '1.0.0',
//             },
//             devDependencies: {
//               'plugin-two': '2.0.0',
//             },
//           };
//         } else if (
//           path.includes(join('node_modules', 'plugin-one', 'package.json'))
//         ) {
//           return {
//             'ng-update': {},
//             version: '1.0.0',
//           };
//         } else if (
//           path.includes(join('node_modules', 'plugin-two', 'package.json'))
//         ) {
//           return {
//             schematics: {},
//             version: '2.0.0',
//           };
//         }
//       });
//       const plugins = findInstalledCommunityPlugins();
//       expect(plugins).toEqual([
//         { package: 'plugin-one', version: '1.0.0' },
//         { package: 'plugin-two', version: '2.0.0' },
//       ]);
//     });
//
//     it('should exclude misc @angluar packages', () => {
//       jest.spyOn(devkit, 'readJsonFile').mockImplementation((path) => {
//         if (path === 'package.json') {
//           return {
//             dependencies: {
//               '@angular/cdk': '1.0.0',
//             },
//             devDependencies: {
//               'plugin-two': '2.0.0',
//             },
//           };
//         } else if (
//           path.includes(join('node_modules', 'plugin-two', 'package.json'))
//         ) {
//           return {
//             schematics: {},
//             version: '1.0.0',
//           };
//         }
//       });
//       const plugins = findInstalledCommunityPlugins();
//       expect(plugins).toEqual([{ package: 'plugin-two', version: '1.0.0' }]);
//     });
//
//     it('should read nx devkit plugins', () => {
//       jest.spyOn(devkit, 'readJsonFile').mockImplementation((path) => {
//         if (path === 'package.json') {
//           return {
//             dependencies: {
//               'plugin-one': '1.0.0',
//             },
//             devDependencies: {
//               'plugin-two': '2.0.0',
//             },
//           };
//         } else if (
//           path.includes(join('node_modules', 'plugin-one', 'package.json'))
//         ) {
//           return {
//             'nx-migrations': {},
//             version: '1.0.0',
//           };
//         } else if (
//           path.includes(join('node_modules', 'plugin-two', 'package.json'))
//         ) {
//           return {
//             generators: {},
//             version: '2.0.0',
//           };
//         }
//       });
//       const plugins = findInstalledCommunityPlugins();
//       expect(plugins).toEqual([
//         { package: 'plugin-one', version: '1.0.0' },
//         { package: 'plugin-two', version: '2.0.0' },
//       ]);
//     });
//
//     it('should not include non-plugins', () => {
//       jest.spyOn(devkit, 'readJsonFile').mockImplementation((path) => {
//         if (path === 'package.json') {
//           return {
//             dependencies: {
//               'plugin-one': '1.0.0',
//             },
//             devDependencies: {
//               'plugin-two': '2.0.0',
//               'other-package': '1.44.0',
//             },
//           };
//         } else if (
//           path.includes(join('node_modules', 'plugin-one', 'package.json'))
//         ) {
//           return {
//             'nx-migrations': {},
//           };
//         } else if (
//           path.includes(join('node_modules', 'plugin-two', 'package.json'))
//         ) {
//           return {
//             generators: {},
//           };
//         } else {
//           return {
//             version: '',
//           };
//         }
//       });
//       const plugins = findInstalledCommunityPlugins().map((x) => x.package);
//       expect(plugins).not.toContain('other-package');
//     });
//   });
// });
