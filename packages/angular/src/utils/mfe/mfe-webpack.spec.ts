jest.mock('fs');
jest.mock('@nrwl/workspace/src/utilities/typescript');
import * as fs from 'fs';
import * as tsUtils from '@nrwl/workspace/src/utilities/typescript';

import { sharePackages, shareWorkspaceLibraries } from './mfe-webpack';

describe('MFE Webpack Utils', () => {
  afterEach(() => jest.clearAllMocks());

  describe('ShareWorkspaceLibraries', () => {
    it('should error when the tsconfig file does not exist', () => {
      // ARRANGE
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      // ACT
      try {
        shareWorkspaceLibraries(['@myorg/shared']);
      } catch (error) {
        // ASSERT
        expect(error.message).toEqual(
          'NX MFE: TsConfig Path for workspace libraries does not exist! (null)'
        );
      }
    });

    it('should create an object with correct setup', () => {
      // ARRANGE
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (tsUtils.readTsConfig as jest.Mock).mockReturnValue({
        options: {
          paths: {
            '@myorg/shared': ['/libs/shared/src/index.ts'],
          },
        },
      });

      // ACT
      const sharedLibraries = shareWorkspaceLibraries(['@myorg/shared']);
      // ASSERT
      expect(sharedLibraries.getAliases()).toHaveProperty('@myorg/shared');
      expect(sharedLibraries.getAliases()['@myorg/shared']).toContain(
        'libs/shared/src/index.ts'
      );
      expect(sharedLibraries.getLibraries()).toEqual({
        '@myorg/shared': {
          eager: undefined,
          requiredVersion: false,
        },
      });
    });

    it('should create an object with empty setup when tsconfig does not contain the shared lib', () => {
      // ARRANGE
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (tsUtils.readTsConfig as jest.Mock).mockReturnValue({
        options: {
          paths: {},
        },
      });

      // ACT
      const sharedLibraries = shareWorkspaceLibraries(['@myorg/shared']);
      // ASSERT
      expect(sharedLibraries.getAliases()).toEqual({});
      expect(sharedLibraries.getLibraries()).toEqual({});
    });
  });

  describe('SharePackages', () => {
    it('should throw when it cannot find root package.json', () => {
      // ARRANGE
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      // ACT
      try {
        sharePackages(['@angular/core']);
      } catch (error) {
        // ASSERT
        expect(error.message).toEqual(
          'NX MFE: Could not find root package.json to determine dependency versions.'
        );
      }
    });

    it('should correctly map the shared packages to objects', () => {
      // ARRANGE
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({
          dependencies: {
            '@angular/core': '~13.2.0',
            '@angular/common': '~13.2.0',
            rxjs: '~7.4.0',
          },
        })
      );

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
  });
});
