import { ensureDirSync } from 'fs-extra';
import {
  createProjectGraphAsync,
  getDependentPackagesForProject,
  getLibraryImportPath,
  readJsonFile,
  writeJsonFile,
} from '@nrwl/devkit';

import { tmpProjPath } from './paths';
import { ensureNxProject } from './nx-project';
import { cleanup } from './utils';
import { runPackageManagerInstall } from './run-package-manager-install';
import { runNxNewCommand } from './async-commands';

jest.mock('fs-extra');

jest.mock('@nrwl/devkit', () => ({
  ...jest.requireActual('@nrwl/devkit'),
  createProjectGraphAsync: jest.fn(),
  getDependentPackagesForProject: jest.fn(),
  getLibraryImportPath: jest.fn(),
  readJsonFile: jest.fn(),
  writeJsonFile: jest.fn(),
  workspaceRoot: 'root',
}));

jest.mock('./async-commands');
jest.mock('./utils');
jest.mock('./paths');
jest.mock('./run-package-manager-install');

describe('ensureNxProject', () => {
  beforeEach(() => {
    (readJsonFile as jest.Mock).mockImplementation((path: string) => {
      switch (path) {
        case 'test-path/package.json':
          return { devDependencies: {} };
        case 'root/dist/libA/package.json':
          return {
            peerDependencies: { '@test/libB': '0.0.0' },
            dependencies: { '@test/libC': '0.0.0' },
          };
        case 'root/dist/libB/package.json':
          return { dependencies: { '@test/libC': '0.0.0' } };
        default:
          return null;
      }
    });
    (writeJsonFile as jest.Mock).mockReturnValue(null);
    (ensureDirSync as jest.Mock).mockReturnValue(null);
    (cleanup as jest.Mock).mockReturnValue(null);
    (runNxNewCommand as jest.Mock).mockReturnValue(null);
    (runPackageManagerInstall as jest.Mock).mockReturnValue(null);
    (tmpProjPath as jest.Mock).mockImplementation(
      (path) => `test-path/${path ?? ''}`
    );
    (getLibraryImportPath as jest.Mock).mockImplementation(
      (name: string) => `@test/${name}`
    );

    (getDependentPackagesForProject as jest.Mock).mockImplementation(
      (_, name: string) => {
        switch (name) {
          case 'libA':
            return {
              workspaceLibraries: [
                {
                  name: 'libB',
                  root: 'packages/libB',
                  importKey: '@test/libB',
                },
                {
                  name: 'libC',
                  root: 'packages/libC',
                  importKey: '@test/libC',
                },
              ],
            };
          case 'libB':
            return {
              workspaceLibraries: [
                {
                  name: 'libC',
                  root: 'packages/libC',
                  importKey: '@test/libC',
                },
              ],
            };
          case 'libC':
            return {
              workspaceLibraries: [],
            };
        }
        throw new Error();
      }
    );

    (createProjectGraphAsync as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        nodes: {
          libA: {
            data: {
              targets: { build: { options: { outputPath: 'dist/libA' } } },
            },
          },
          libB: {
            data: {
              targets: { build: { options: { outputPath: 'dist/libB' } } },
            },
          },
          libC: {
            data: {
              targets: { build: { options: { outputPath: 'dist/libC' } } },
            },
          },
        },
      })
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should execute commands', async () => {
    await ensureNxProject('libA');

    expect(ensureDirSync).toHaveBeenCalledWith(`test-path/`);
    expect(cleanup).toHaveBeenCalled();
    expect(runNxNewCommand).toHaveBeenCalled();
    expect(runPackageManagerInstall).toHaveBeenCalled();
  });

  it('should update package json in lib folders with dependencies and run install command', async () => {
    await ensureNxProject('libA');

    expect(writeJsonFile).toHaveBeenCalledWith('root/dist/libA/package.json', {
      peerDependencies: { '@test/libB': `file:root/dist/libB` },
      dependencies: { '@test/libC': `file:root/dist/libC` },
    });
    expect(writeJsonFile).toHaveBeenCalledWith('root/dist/libB/package.json', {
      dependencies: { '@test/libC': `file:root/dist/libC` },
    });

    expect(runPackageManagerInstall).toHaveBeenCalledWith(
      true,
      'root/dist/libB'
    );
    expect(runPackageManagerInstall).toHaveBeenCalledWith(
      true,
      'root/dist/libA'
    );
  });

  it('should update package json in temp folder with dependencies and run install command', async () => {
    await ensureNxProject('libA');

    expect(writeJsonFile).toHaveBeenCalledWith('test-path/package.json', {
      devDependencies: { '@test/libA': `file:root/dist/libA` },
    });

    expect(runPackageManagerInstall).toHaveBeenCalledWith();
  });

  it('should not update any files if library does not have workspace dependencies', async () => {
    await ensureNxProject('libC');

    expect(writeJsonFile).not.toHaveBeenCalled();
  });

  it('should fail if project is not in workspace', async () => {
    await expect(
      async () => await ensureNxProject('unknown-lib')
    ).rejects.toStrictEqual(
      new Error(`Could not find project with name "unknown-lib"`)
    );
  });
});
