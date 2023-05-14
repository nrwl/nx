jest.mock('fs');
import * as fs from 'fs';
import * as configModule from '../config/configuration';
import { detectPackageManager } from './package-manager';

describe('package-manager', () => {
  it('should detect package manager in nxJson', () => {
    jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({
      cli: {
        packageManager: 'pnpm',
      },
    });
    const packageManager = detectPackageManager();
    expect(packageManager).toEqual('pnpm');
    expect(fs.existsSync).not.toHaveBeenCalled();
  });

  it('should detect yarn package manager from yarn.lock', () => {
    jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({});
    (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
    const packageManager = detectPackageManager();
    expect(packageManager).toEqual('yarn');
    expect(fs.existsSync).toHaveBeenNthCalledWith(1, 'yarn.lock');
  });

  it('should detect pnpm package manager from pnpm-lock.yaml', () => {
    jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({});
    (fs.existsSync as jest.Mock).mockImplementation((path) => {
      return path === 'pnpm-lock.yaml';
    });
    const packageManager = detectPackageManager();
    expect(packageManager).toEqual('pnpm');
    expect(fs.existsSync).toHaveBeenCalledTimes(3);
  });

  it('should use npm package manager as default', () => {
    jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({});
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    const packageManager = detectPackageManager();
    expect(packageManager).toEqual('npm');
    expect(fs.existsSync).toHaveBeenCalledTimes(5);
  });
});
