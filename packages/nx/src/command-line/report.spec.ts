import * as fileUtils from '../utils/fileutils';
import * as packageJsonUtils from '../utils/package-json';
import {
  findInstalledCommunityPlugins,
  findInstalledPackagesWeCareAbout,
  findMisalignedPackagesForPackage,
  packagesWeCareAbout,
} from './report';

jest.mock('nx/src/utils/workspace-root', () => ({
  workspaceRoot: '',
}));

jest.mock('../utils/fileutils', () => ({
  ...(jest.requireActual('../utils/fileutils') as typeof fileUtils),
  resolve: (file) => `node_modules/${file}`,
}));

describe('report', () => {
  describe('findInstalledCommunityPlugins', () => {
    afterEach(() => jest.resetAllMocks());

    it('should read angular-devkit plugins', () => {
      jest.spyOn(fileUtils, 'readJsonFile').mockImplementation((path) => {
        if (path === 'package.json') {
          return {
            dependencies: {
              'plugin-one': '1.0.0',
            },
            devDependencies: {
              'plugin-two': '2.0.0',
            },
          };
        } else if (path === 'nx.json') {
          return {};
        }
      });
      jest.spyOn(packageJsonUtils, 'readModulePackageJson').mockImplementation(
        provideMockPackages({
          'plugin-one': {
            'ng-update': {},
            version: '1.0.0',
          },
          'plugin-two': {
            schematics: '',
            version: '2.0.0',
          },
        })
      );
      const plugins = findInstalledCommunityPlugins();
      expect(plugins).toEqual([
        expect.objectContaining({ name: 'plugin-one', version: '1.0.0' }),
        expect.objectContaining({ name: 'plugin-two', version: '2.0.0' }),
      ]);
    });

    it('should exclude misc @angluar packages', () => {
      jest.spyOn(fileUtils, 'readJsonFile').mockImplementation((path) => {
        if (path === 'package.json') {
          return {
            dependencies: {
              '@angular/cdk': '1.0.0',
            },
            devDependencies: {
              'plugin-two': '2.0.0',
            },
          };
        } else if (path === 'nx.json') {
          return {};
        }
      });
      jest.spyOn(packageJsonUtils, 'readModulePackageJson').mockImplementation(
        provideMockPackages({
          'plugin-two': {
            schematics: '',
            version: '2.0.0',
          },
        })
      );
      const plugins = findInstalledCommunityPlugins();
      expect(plugins).toEqual([
        expect.objectContaining({ name: 'plugin-two', version: '2.0.0' }),
      ]);
    });

    it('should read nx devkit plugins', () => {
      jest.spyOn(fileUtils, 'readJsonFile').mockImplementation((path) => {
        if (path === 'package.json') {
          return {
            dependencies: {
              'plugin-one': '1.0.0',
            },
            devDependencies: {
              'plugin-two': '2.0.0',
            },
          };
        } else if (path === 'nx.json') {
          return {};
        }
      });
      jest.spyOn(packageJsonUtils, 'readModulePackageJson').mockImplementation(
        provideMockPackages({
          'plugin-one': {
            'nx-migrations': {},
            version: '1.0.0',
          },
          'plugin-two': {
            generators: '',
            version: '2.0.0',
          },
        })
      );
      const plugins = findInstalledCommunityPlugins();
      expect(plugins).toEqual([
        expect.objectContaining({ name: 'plugin-one', version: '1.0.0' }),
        expect.objectContaining({ name: 'plugin-two', version: '2.0.0' }),
      ]);
    });

    it('should read nx plugins from installations', () => {
      jest.spyOn(fileUtils, 'readJsonFile').mockImplementation((path) => {
        if (path === 'package.json') {
          return {
            dependencies: {},
            devDependencies: {
              'plugin-two': '2.0.0',
            },
          };
        } else if (path === 'nx.json') {
          return {
            installation: {
              version: '1.12.0',
              plugins: {
                'plugin-one': '1.0.0',
              },
            },
          };
        }
      });
      jest.spyOn(packageJsonUtils, 'readModulePackageJson').mockImplementation(
        provideMockPackages({
          'plugin-one': {
            'nx-migrations': {},
            version: '1.0.0',
          },
          'plugin-two': {
            generators: '',
            version: '2.0.0',
          },
        })
      );
      const plugins = findInstalledCommunityPlugins();
      expect(plugins).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'plugin-one', version: '1.0.0' }),
          expect.objectContaining({ name: 'plugin-two', version: '2.0.0' }),
        ])
      );
    });

    it('should not include non-plugins', () => {
      jest.spyOn(fileUtils, 'readJsonFile').mockImplementation((path) => {
        if (path === 'package.json') {
          return {
            dependencies: {
              'plugin-one': '1.0.0',
            },
            devDependencies: {
              'plugin-two': '2.0.0',
              'other-package': '1.44.0',
            },
          };
        } else if (path === 'nx.json') {
          return {};
        }
      });
      jest.spyOn(packageJsonUtils, 'readModulePackageJson').mockImplementation(
        provideMockPackages({
          'plugin-one': {
            'nx-migrations': {},
            version: '1.0.0',
          },
          'plugin-two': {
            generators: '',
            version: '2.0.0',
          },
          'other-package': {
            version: '1.44.0',
          },
        })
      );
      const plugins = findInstalledCommunityPlugins().map((x) => x.name);
      expect(plugins).not.toContain('other-package');
    });
  });

  describe('findInstalledPackagesWeCareAbout', () => {
    it('should not list packages that are not installed', () => {
      const installed: [string, packageJsonUtils.PackageJson][] =
        packagesWeCareAbout.map((x) => [
          x,
          {
            name: x,
            version: '1.0.0',
          },
        ]);
      const uninstalled: [string, packageJsonUtils.PackageJson][] = [
        installed.pop(),
        installed.pop(),
        installed.pop(),
        installed.pop(),
      ].map((x) => [x[0], null]);

      jest
        .spyOn(packageJsonUtils, 'readModulePackageJson')
        .mockImplementation(
          provideMockPackages(Object.fromEntries(installed.concat(uninstalled)))
        );

      const result = findInstalledPackagesWeCareAbout().map((x) => x.package);
      for (const [pkg] of uninstalled) {
        expect(result).not.toContain(pkg);
      }
      for (const [pkg] of installed) {
        expect(result).toContain(pkg);
      }
    });
  });

  describe('findMisalignedPackagesForPackage', () => {
    it('should identify misaligned packages for array specified package groups', () => {
      jest.spyOn(packageJsonUtils, 'readModulePackageJson').mockImplementation(
        provideMockPackages({
          'plugin-one': {
            'ng-update': {},
            version: '1.0.0',
          },
          'plugin-two': {
            schematics: '',
            version: '2.0.0',
          },
        })
      );
      const results = findMisalignedPackagesForPackage({
        name: 'my-package',
        version: '1.0.0',
        'nx-migrations': {
          packageGroup: ['plugin-one', 'plugin-two'],
        },
      });
      expect(results.misalignedPackages).toEqual([
        {
          name: 'plugin-two',
          version: '2.0.0',
        },
      ]);
      expect(results.migrateTarget).toEqual('my-package@2.0.0');
    });

    it('should identify misaligned packages for expanded array specified package groups', () => {
      jest.spyOn(packageJsonUtils, 'readModulePackageJson').mockImplementation(
        provideMockPackages({
          'plugin-one': {
            'ng-update': {},
            version: '0.5.0',
          },
          'plugin-two': {
            schematics: '',
            version: '2.0.0',
          },
        })
      );
      const results = findMisalignedPackagesForPackage({
        name: 'my-package',
        version: '1.0.0',
        'nx-migrations': {
          packageGroup: [
            { package: 'plugin-one', version: '*' },
            { package: 'plugin-two', version: 'latest' },
          ],
        },
      });
      expect(results.misalignedPackages).toEqual([
        {
          name: 'plugin-one',
          version: '0.5.0',
        },
      ]);
      expect(results.migrateTarget).toEqual('my-package@1.0.0');
    });

    it('should identify misaligned packages for object specified package groups', () => {
      jest.spyOn(packageJsonUtils, 'readModulePackageJson').mockImplementation(
        provideMockPackages({
          'plugin-one': {
            'ng-update': {},
            version: '0.5.0',
          },
          'plugin-two': {
            schematics: '',
            version: '2.0.0',
          },
        })
      );
      const results = findMisalignedPackagesForPackage({
        name: 'my-package',
        version: '1.0.0',
        'nx-migrations': {
          packageGroup: {
            'plugin-one': '*',
            'plugin-two': 'latest',
          },
        },
      });
      expect(results.misalignedPackages).toEqual([
        {
          name: 'plugin-one',
          version: '0.5.0',
        },
      ]);
      expect(results.migrateTarget).toEqual('my-package@1.0.0');
    });
  });
});

function provideMockPackages(
  packages: Record<string, Omit<packageJsonUtils.PackageJson, 'name'>>
): (m: string) => ReturnType<typeof packageJsonUtils.readModulePackageJson> {
  return (m) => {
    if (m in packages) {
      return {
        path: `node_modules/${m}/package.json`,
        packageJson: { name: m, ...packages[m] },
      };
    } else {
      throw new Error(`Attempted to read unmocked package ${m}`);
    }
  };
}
