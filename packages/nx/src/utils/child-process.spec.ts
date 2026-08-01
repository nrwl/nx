jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
}));
jest.mock('../native', () => ({ ChildProcess: class {} }));
jest.mock('./package-manager', () => ({
  detectPackageManager: jest.fn(),
  getPackageManagerCommand: jest.fn(),
}));
jest.mock('./workspace-root', () => ({
  workspaceRoot: '/root',
  workspaceRootInner: jest.fn(() => '/root'),
}));

import { existsSync } from 'fs';
import { getRunNxBaseCommand } from './child-process';
import type { PackageManagerCommands } from './package-manager';

describe('getRunNxBaseCommand', () => {
  const pmc = { exec: 'npx' } as PackageManagerCommands;

  function withPlatform(platform: NodeJS.Platform, fn: () => void) {
    const original = process.platform;
    Object.defineProperty(process, 'platform', { value: platform });
    try {
      fn();
    } finally {
      Object.defineProperty(process, 'platform', { value: original });
    }
  }

  it('should run nx through the package manager when the workspace has a package.json', () => {
    (existsSync as jest.Mock).mockReturnValue(true);
    expect(getRunNxBaseCommand(pmc, '/root')).toBe('npx nx');
  });

  it('should use the nx.bat wrapper on Windows when there is no package.json', () => {
    (existsSync as jest.Mock).mockReturnValue(false);
    withPlatform('win32', () => {
      expect(getRunNxBaseCommand(pmc, '/root')).toBe('.\\nx.bat');
    });
  });

  it('should use the ./nx wrapper on non-Windows platforms when there is no package.json', () => {
    (existsSync as jest.Mock).mockReturnValue(false);
    withPlatform('linux', () => {
      expect(getRunNxBaseCommand(pmc, '/root')).toBe('./nx');
    });
  });
});
