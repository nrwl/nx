jest.mock('fs');
import * as fs from 'fs';
import * as nxJsonUtils from '../config/nx-json';
import {
  detectPackageManager,
  modifyYarnRcToFitNewDirectory,
  modifyYarnRcYmlToFitNewDirectory,
} from './package-manager';

describe('package-manager', () => {
  describe('detectPackageManager', () => {
    it('should detect package manager in nxJson', () => {
      jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValueOnce({
        cli: {
          packageManager: 'pnpm',
        },
      });
      const packageManager = detectPackageManager();
      expect(packageManager).toEqual('pnpm');
      expect(fs.existsSync).not.toHaveBeenCalled();
    });

    it('should detect yarn package manager from yarn.lock', () => {
      jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValueOnce({});
      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      const packageManager = detectPackageManager();
      expect(packageManager).toEqual('yarn');
      expect(fs.existsSync).toHaveBeenNthCalledWith(1, 'yarn.lock');
    });

    it('should detect pnpm package manager from pnpm-lock.yaml', () => {
      jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValueOnce({});
      (fs.existsSync as jest.Mock).mockImplementation((path) => {
        return path === 'pnpm-lock.yaml';
      });
      const packageManager = detectPackageManager();
      expect(packageManager).toEqual('pnpm');
      expect(fs.existsSync).toHaveBeenCalledTimes(3);
    });

    it('should use npm package manager as default', () => {
      jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValueOnce({});
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      const packageManager = detectPackageManager();
      expect(packageManager).toEqual('npm');
      expect(fs.existsSync).toHaveBeenCalledTimes(5);
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
