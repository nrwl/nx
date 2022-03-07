jest.mock('fs');
jest.mock('@nrwl/workspace');
import * as fs from 'fs';
import * as workspace from '@nrwl/workspace';

import { shareWorkspaceLibraries } from './mfe-webpack';

describe('MFE Webpack Utils', () => {
  afterEach(() => jest.clearAllMocks());

  it('should error when the tsconfig file does not exist', () => {
    // ARRANGE
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    // ACT
    try {
      shareWorkspaceLibraries(['@myorg/shared']);
    } catch (error) {
      // ASSERT
      expect(error.message).toEqual(
        'NX MFE: TsConfig Path for workspace libraries does not exist! (undefined)'
      );
    }
  });

  it('should create an object with correct setup', () => {
    // ARRANGE
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (workspace.readTsConfig as jest.Mock).mockReturnValue({
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
    (workspace.readTsConfig as jest.Mock).mockReturnValue({
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
