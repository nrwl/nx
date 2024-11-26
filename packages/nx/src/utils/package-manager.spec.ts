import * as fs from 'fs';
import * as childProcess from 'child_process';
import * as configModule from '../config/configuration';
import * as projectGraphFileUtils from '../project-graph/file-utils';
import * as fileUtils from '../utils/fileutils';
import {
  detectPackageManager,
  getPackageManagerVersion,
  isWorkspacesEnabled,
  modifyYarnRcToFitNewDirectory,
  modifyYarnRcYmlToFitNewDirectory,
} from './package-manager';

describe('package-manager', () => {
  describe('detectPackageManager', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });
    it('should detect package manager in nxJson', () => {
      jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({
        cli: {
          packageManager: 'pnpm',
        },
      });
      const packageManager = detectPackageManager();
      expect(packageManager).toEqual('pnpm');
    });

    it('should detect yarn package manager from yarn.lock', () => {
      jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({});
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        switch (p) {
          case 'yarn.lock':
            return true;
          case 'pnpm-lock.yaml':
            return false;
          case 'package-lock.json':
            return false;
          case 'bun.lockb':
            return false;
          default:
            return jest.requireActual('fs').existsSync(p);
        }
      });
      const packageManager = detectPackageManager();
      expect(packageManager).toEqual('yarn');
      expect(fs.existsSync).toHaveBeenNthCalledWith(2, 'yarn.lock');
    });

    it('should detect pnpm package manager from pnpm-lock.yaml', () => {
      jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({});
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        switch (p) {
          case 'yarn.lock':
            return false;
          case 'pnpm-lock.yaml':
            return true;
          case 'package-lock.json':
            return false;
          case 'bun.lockb':
            return false;
          default:
            return jest.requireActual('fs').existsSync(p);
        }
      });
      const packageManager = detectPackageManager();
      expect(packageManager).toEqual('pnpm');
      expect(fs.existsSync).toHaveBeenCalledTimes(3);
    });

    it('should detect bun package manager from bun.lockb', () => {
      jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({});
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        switch (p) {
          case 'yarn.lock':
            return false;
          case 'pnpm-lock.yaml':
            return false;
          case 'package-lock.json':
            return false;
          case 'bun.lockb':
            return true;
          default:
            return jest.requireActual('fs').existsSync(p);
        }
      });
      const packageManager = detectPackageManager();
      expect(packageManager).toEqual('bun');
      expect(fs.existsSync).toHaveBeenCalledTimes(1);
    });

    it('should use npm package manager as default', () => {
      jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({});
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        switch (p) {
          case 'yarn.lock':
            return false;
          case 'pnpm-lock.yaml':
            return false;
          case 'package-lock.json':
            return false;
          case 'bun.lockb':
            return false;
          default:
            return jest.requireActual('fs').existsSync(p);
        }
      });
      const packageManager = detectPackageManager();
      expect(packageManager).toEqual('npm');
      expect(fs.existsSync).toHaveBeenCalledTimes(3);
    });
  });

  describe('getPackageManagerVersion', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should detect package manager from --version', () => {
      jest.spyOn(childProcess, 'execSync').mockImplementation((p) => {
        switch (p) {
          case 'yarn --version':
            return '1.22.10';
          case 'pnpm --version':
            return '5.17.5';
          case 'npm --version':
            return '7.20.3';
          default:
            return jest.requireActual('child_process').execSync(p);
        }
      });
      expect(getPackageManagerVersion('yarn')).toEqual('1.22.10');
      expect(getPackageManagerVersion('pnpm')).toEqual('5.17.5');
      expect(getPackageManagerVersion('npm')).toEqual('7.20.3');
    });

    it('should detect pnpm package manager version from package.json packageManager', () => {
      jest.spyOn(childProcess, 'execSync').mockImplementation(() => {
        throw new Error('Command failed');
      });
      jest
        .spyOn(fileUtils, 'readJsonFile')
        .mockReturnValueOnce({ packageManager: 'pnpm@6.32.4' });
      expect(getPackageManagerVersion('pnpm')).toEqual('6.32.4');
    });

    it('should detect yarn package manager from package.json packageManager', () => {
      jest.spyOn(childProcess, 'execSync').mockImplementation(() => {
        throw new Error('Command failed');
      });
      jest
        .spyOn(fileUtils, 'readJsonFile')
        .mockReturnValueOnce({ packageManager: 'yarn@6.32.4' });
      expect(getPackageManagerVersion('yarn')).toEqual('6.32.4');
    });

    it('should detect npm package manager from package.json packageManager', () => {
      jest.spyOn(childProcess, 'execSync').mockImplementation(() => {
        throw new Error('Command failed');
      });
      jest
        .spyOn(fileUtils, 'readJsonFile')
        .mockReturnValueOnce({ packageManager: 'npm@6.32.4' });
      expect(getPackageManagerVersion('npm')).toEqual('6.32.4');
    });

    it('should throw an error if packageManager does not exist in package.json', () => {
      jest.spyOn(childProcess, 'execSync').mockImplementation(() => {
        throw new Error('Command failed');
      });
      jest.spyOn(fileUtils, 'readJsonFile').mockReturnValueOnce({});
      expect(() => getPackageManagerVersion('npm')).toThrowError();
    });

    it('should throw an error if packageManager in package.json does not match detected pacakge manager', () => {
      jest.spyOn(childProcess, 'execSync').mockImplementation(() => {
        throw new Error('Command failed');
      });
      jest
        .spyOn(fileUtils, 'readJsonFile')
        .mockReturnValueOnce({ packageManager: 'npm@6.32.4' });
      expect(() => getPackageManagerVersion('yarn')).toThrowError();
    });
  });

  describe('isWorkspacesEnabled', () => {
    it('should return true if package manager is pnpm and pnpm-workspace.yaml exists', () => {
      jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
      expect(isWorkspacesEnabled('pnpm')).toEqual(true);
    });

    it('should return false if package manager is pnpm and pnpm-workspace.yaml does not exist', () => {
      jest.spyOn(fs, 'existsSync').mockReturnValueOnce(false);
      expect(isWorkspacesEnabled('pnpm')).toEqual(false);
    });

    it('should return true if package manager is yarn and workspaces exists in package.json', () => {
      jest
        .spyOn(projectGraphFileUtils, 'readPackageJson')
        .mockReturnValueOnce({ workspaces: ['packages/*'] });
      expect(isWorkspacesEnabled('yarn')).toEqual(true);
    });

    it('should return false if package manager is yarn and workspaces does not exist in package.json', () => {
      jest
        .spyOn(projectGraphFileUtils, 'readPackageJson')
        .mockReturnValueOnce({});
      expect(isWorkspacesEnabled('yarn')).toEqual(false);
    });

    it('should return true if package manager is npm and workspaces exists in package.json', () => {
      jest
        .spyOn(projectGraphFileUtils, 'readPackageJson')
        .mockReturnValueOnce({ workspaces: ['packages/*'] });
      expect(isWorkspacesEnabled('npm')).toEqual(true);
    });

    it('should return false if package manager is npm and workspaces does not exist in package.json', () => {
      jest
        .spyOn(projectGraphFileUtils, 'readPackageJson')
        .mockReturnValueOnce({});
      expect(isWorkspacesEnabled('npm')).toEqual(false);
    });
  });

  describe('modifyYarnRcYmlToFitNewDirectory', () => {
    it('should update paths properly', () => {
      expect(
        modifyYarnRcYmlToFitNewDirectory('yarnPath: ./bin/yarn.js')
      ).toEqual('');
    });

    it('should update plugins appropriately', () => {
      expect(
        modifyYarnRcYmlToFitNewDirectory(
          [
            'enableProgressBars: false',
            'plugins:',
            '  - ./scripts/yarn-plugin.js',
            '  - path: .yarn/plugins/imported-plugin.js',
            '    spec: imported-plugin',
          ].join('\n')
        )
      ).toEqual('enableProgressBars: false\n');
    });
  });

  describe('modifyYarnRcToFitNewDirectory', () => {
    it('should update paths properly', () => {
      expect(modifyYarnRcToFitNewDirectory('yarn-path ./bin/yarn.js')).toEqual(
        ''
      );
    });

    it('should not update other options', () => {
      expect(
        modifyYarnRcToFitNewDirectory(
          ['yarn-path ./bin/yarn.js', 'enableProgressBars false'].join('\n')
        )
      ).toEqual('enableProgressBars false');
    });
  });
});
