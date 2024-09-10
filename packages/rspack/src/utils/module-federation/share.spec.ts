import * as fs from 'fs';
import * as nxFileutils from 'nx/src/devkit-exports';
import { sharePackages, shareWorkspaceLibraries } from './share';
import * as tsUtils from './typescript';

jest.mock('nx/src/devkit-exports', () => {
  return {
    ...jest.requireActual('nx/src/devkit-exports'),
    readJsonFile: jest.fn(),
  };
});

describe('MF Share Utils', () => {
  afterEach(() => jest.clearAllMocks());

  describe('ShareWorkspaceLibraries', () => {
    it('should error when the tsconfig file does not exist', () => {
      // ARRANGE
      jest
        .spyOn(fs, 'existsSync')
        .mockImplementation((p: string) => p?.endsWith('.node'));

      // ACT
      try {
        shareWorkspaceLibraries([
          { name: 'shared', root: 'libs/shared', importKey: '@myorg/shared' },
        ]);
      } catch (error) {
        // ASSERT
        expect(error.message).toContain(
          'NX MF: TsConfig Path for workspace libraries does not exist!'
        );
      }
    });

    it('should create an object with correct setup', () => {
      // ARRANGE
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(tsUtils, 'readTsPathMappings').mockReturnValue({
        '@myorg/shared': ['/libs/shared/src/index.ts'],
      });

      // ACT
      const sharedLibraries = shareWorkspaceLibraries([
        { name: 'shared', root: 'libs/shared', importKey: '@myorg/shared' },
      ]);

      // ASSERT
      expect(sharedLibraries.getAliases()).toHaveProperty('@myorg/shared');
      expect(sharedLibraries.getAliases()['@myorg/shared']).toContain(
        'libs/shared/src/index.ts'
      );
      expect(sharedLibraries.getLibraries('libs/shared')).toEqual({
        '@myorg/shared': {
          eager: undefined,
          requiredVersion: false,
        },
      });
    });

    it('should order nested projects first', () => {
      // ARRANGE
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(tsUtils, 'readTsPathMappings').mockReturnValue({
        '@myorg/shared': ['/libs/shared/src/index.ts'],
        '@myorg/shared/components': ['/libs/shared/components/src/index.ts'],
      });

      // ACT
      const sharedLibraries = shareWorkspaceLibraries([
        { name: 'shared', root: 'libs/shared', importKey: '@myorg/shared' },
        {
          name: 'shared-components',
          root: 'libs/shared/components',
          importKey: '@myorg/shared/components',
        },
      ]);

      // ASSERT
      expect(Object.keys(sharedLibraries.getAliases())[0]).toEqual(
        '@myorg/shared/components'
      );
    });

    it('should handle path mappings with wildcards correctly in non-buildable libraries', () => {
      // ARRANGE
      jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
      jest.spyOn(tsUtils, 'readTsPathMappings').mockReturnValue({
        '@myorg/shared': ['/libs/shared/src/index.ts'],
        '@myorg/shared/*': ['/libs/shared/src/lib/*'],
      });

      // ACT
      const sharedLibraries = shareWorkspaceLibraries([
        { name: 'shared', root: 'libs/shared', importKey: '@myorg/shared' },
      ]);

      // ASSERT
      expect(sharedLibraries.getAliases()).toHaveProperty('@myorg/shared');
      expect(sharedLibraries.getAliases()['@myorg/shared']).toContain(
        'libs/shared/src/index.ts'
      );
      expect(sharedLibraries.getLibraries('libs/shared')).toEqual({
        '@myorg/shared': {
          eager: undefined,
          requiredVersion: false,
        },
      });
    });

    it('should create an object with empty setup when tsconfig does not contain the shared lib', () => {
      // ARRANGE
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(tsUtils, 'readTsPathMappings').mockReturnValue({});

      // ACT
      const sharedLibraries = shareWorkspaceLibraries([
        { name: 'shared', root: 'libs/shared', importKey: '@myorg/shared' },
      ]);

      // ASSERT
      expect(sharedLibraries.getAliases()).toEqual({});
      expect(sharedLibraries.getLibraries('libs/shared')).toEqual({});
    });
  });

  describe('SharePackages', () => {
    it('should throw when it cannot find root package.json', () => {
      // ARRANGE
      jest
        .spyOn(fs, 'existsSync')
        .mockImplementation((p: string) => p.endsWith('.node'));

      // ACT
      try {
        sharePackages(['@angular/core']);
      } catch (error) {
        // ASSERT
        expect(error.message).toEqual(
          'NX MF: Could not find root package.json to determine dependency versions.'
        );
      }
    });

    it('should correctly map the shared packages to objects', () => {
      // ARRANGE
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(nxFileutils, 'readJsonFile').mockImplementation((file) => ({
        name: file.replace(/\\/g, '/').replace(/^.*node_modules[/]/, ''),
        dependencies: {
          '@angular/core': '~13.2.0',
          '@angular/common': '~13.2.0',
          rxjs: '~7.4.0',
        },
      }));
      jest.spyOn(fs, 'readdirSync').mockReturnValue([]);

      // ACT
      const packages = sharePackages([
        '@angular/core',
        '@angular/common',
        'rxjs',
      ]);
      // ASSERT
      expect(packages).toEqual({
        '@angular/core': {
          singleton: true,
          strictVersion: true,
          requiredVersion: '~13.2.0',
        },
        '@angular/common': {
          singleton: true,
          strictVersion: true,
          requiredVersion: '~13.2.0',
        },
        rxjs: {
          singleton: true,
          strictVersion: true,
          requiredVersion: '~7.4.0',
        },
      });
    });

    // TODO: Get with colum and figure out why this stopped working
    xit('should correctly map the shared packages to objects even with nested entry points', () => {
      // ARRANGE

      /**
       * This creates a bunch of mocks that aims to test that
       * the sharePackages function can handle nested
       * entrypoints in the package that is being shared.
       *
       * This will set up a directory structure that matches
       * the following:
       *
       * - @angular/core/
       *   - package.json
       * - @angular/common/
       *   - http/
       *     - testing/
       *       - package.json
       *   - package.json
       * - rxjs
       *   - package.json
       *
       * The result is that there would be 4 packages that
       * need to be shared, as determined by the folders
       * containing the package.json files
       */
      createMockedFSForNestedEntryPoints();

      // ACT
      const packages = sharePackages([
        '@angular/core',
        '@angular/common',
        'rxjs',
      ]);
      // ASSERT
      expect(packages).toEqual({
        '@angular/core': {
          singleton: true,
          strictVersion: true,
          requiredVersion: '~13.2.0',
        },
        '@angular/common': {
          singleton: true,
          strictVersion: true,
          requiredVersion: '~13.2.0',
        },
        '@angular/common/http/testing': {
          singleton: true,
          strictVersion: true,
          requiredVersion: '~13.2.0',
        },
        rxjs: {
          singleton: true,
          strictVersion: true,
          requiredVersion: '~7.4.0',
        },
      });
    });

    it('should not throw when the main entry point package.json cannot be required', () => {
      // ARRANGE
      jest
        .spyOn(fs, 'existsSync')
        .mockImplementation(
          (file: string) =>
            !file.endsWith('non-existent-top-level-package/package.json')
        );
      jest.spyOn(nxFileutils, 'readJsonFile').mockImplementation((file) => {
        return {
          name: file
            .replace(/\\/g, '/')
            .replace(/^.*node_modules[/]/, '')
            .replace('/package.json', ''),
          dependencies: { '@angular/core': '~13.2.0' },
        };
      });

      // ACT & ASSERT
      expect(() =>
        sharePackages(['non-existent-top-level-package'])
      ).not.toThrow();
    });
  });

  it('should using shared library version from root package.json if available', () => {
    // ARRANGE
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest
      .spyOn(nxFileutils, 'readJsonFile')
      .mockImplementation((file: string) => {
        if (file.endsWith('package.json')) {
          return {
            dependencies: {
              '@myorg/shared': '1.0.0',
            },
          };
        }
      });

    jest.spyOn(tsUtils, 'readTsPathMappings').mockReturnValue({
      '@myorg/shared': ['/libs/shared/src/index.ts'],
      '@myorg/shared/*': ['/libs/shared/src/lib/*'],
    });

    // ACT
    const sharedLibraries = shareWorkspaceLibraries(
      [{ name: 'shared', root: 'libs/shared', importKey: '@myorg/shared' }],
      '/'
    );

    // ASSERT
    expect(sharedLibraries.getLibraries('libs/shared')).toEqual({
      '@myorg/shared': {
        eager: undefined,
        requiredVersion: '1.0.0',
        singleton: true,
      },
    });
  });

  it('should use shared library version from library package.json if project package.json does not have it', () => {
    // ARRANGE
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest
      .spyOn(nxFileutils, 'readJsonFile')
      .mockImplementation((file: string) => {
        if (file.endsWith('libs/shared/package.json')) {
          return {
            version: '1.0.0',
          };
        } else {
          return {};
        }
      });

    jest.spyOn(tsUtils, 'readTsPathMappings').mockReturnValue({
      '@myorg/shared': ['/libs/shared/src/index.ts'],
      '@myorg/shared/*': ['/libs/shared/src/lib/*'],
    });

    // ACT
    const sharedLibraries = shareWorkspaceLibraries(
      [{ name: 'shared', root: 'libs/shared', importKey: '@myorg/shared' }],
      null
    );

    // ASSERT
    expect(sharedLibraries.getLibraries('libs/shared')).toEqual({
      '@myorg/shared': {
        eager: undefined,
        requiredVersion: '1.0.0',
        singleton: true,
      },
    });
  });
});

function createMockedFSForNestedEntryPoints() {
  jest.spyOn(fs, 'existsSync').mockImplementation((file: string) => {
    if (file.endsWith('http/package.json')) {
      return false;
    } else {
      return true;
    }
  });

  jest.spyOn(nxFileutils, 'readJsonFile').mockImplementation((file) => ({
    name: file
      .replace(/\\/g, '/')
      .replace(/^.*node_modules[/]/, '')
      .replace('/package.json', ''),
    dependencies: {
      '@angular/core': '~13.2.0',
      '@angular/common': '~13.2.0',
      rxjs: '~7.4.0',
    },
  }));

  jest.spyOn(fs, 'readdirSync').mockImplementation((directoryPath: string) => {
    const PACKAGE_SETUP = {
      '@angular/core': [],
      '@angular/common': ['http'],
      http: ['testing'],
      testing: [],
    };

    for (const key of Object.keys(PACKAGE_SETUP)) {
      if (directoryPath.endsWith(key)) {
        return PACKAGE_SETUP[key];
      }
    }
    return [];
  });

  jest
    .spyOn(fs, 'lstatSync')
    .mockReturnValue({ isDirectory: () => true } as any);
}
