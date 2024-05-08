import * as fs from 'fs';
import * as configModule from '../config/configuration';
import * as projectGraphFileUtils from '../project-graph/file-utils';
import {
  detectPackageManager,
  isWorkspacesEnabled,
  modifyYarnRcToFitNewDirectory,
  modifyYarnRcYmlToFitNewDirectory,
} from './package-manager';

describe('package-manager', () => {
  describe('detectPackageManager', () => {
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
          default:
            return jest.requireActual('fs').existsSync(p);
        }
      });
      const packageManager = detectPackageManager();
      expect(packageManager).toEqual('yarn');
      expect(fs.existsSync).toHaveBeenNthCalledWith(1, 'yarn.lock');
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
          default:
            return jest.requireActual('fs').existsSync(p);
        }
      });
      const packageManager = detectPackageManager();
      expect(packageManager).toEqual('pnpm');
      expect(fs.existsSync).toHaveBeenCalledTimes(3);
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
          default:
            return jest.requireActual('fs').existsSync(p);
        }
      });
      const packageManager = detectPackageManager();
      expect(packageManager).toEqual('npm');
      expect(fs.existsSync).toHaveBeenCalledTimes(5);
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
