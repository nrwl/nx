import { ExecException } from 'child_process';
import { join } from 'path';
import {
  getNpmRegistry,
  getNpmTag,
  isPnpmV11Plus,
  parseRegistryOptions,
} from './npm-config';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { detectPackageManager, getPackageManagerVersion } from '@nx/devkit';
import { PackageJson } from '@nx/devkit/internal';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  detectPackageManager: jest.fn(() => 'npm'),
  getPackageManagerVersion: jest.fn(() => '11.0.0'),
}));

jest.mock('child_process', () => {
  const original = jest.requireActual('child_process');
  return {
    ...original,
    exec: jest
      .fn()
      .mockImplementation(
        (
          command: string,
          _: unknown,
          callback: (
            error: ExecException,
            stdout: string,
            stderr: string
          ) => void
        ) => {
          switch (command) {
            case 'npm config get @scope:registry':
              callback(null, 'https://scoped-registry.com', null);
              break;
            case 'npm config get @missing:registry':
              callback(null, 'undefined', null);
              break;
            case 'npm config get registry':
              callback(null, 'https://custom-registry.com', null);
              break;
            case 'npm config get tag':
              callback(null, 'next', null);
              break;
            case 'pnpm config get @scope:registry':
              callback(null, 'https://pnpm-scoped-registry.com', null);
              break;
            case 'pnpm config get registry':
              callback(null, 'https://pnpm-registry.com', null);
              break;
            case 'pnpm config get tag':
              callback(null, 'pnpm-next', null);
              break;
            default:
              callback(
                new Error(`unexpected command: ${command}`),
                null,
                'ERROR'
              );
          }
        }
      ),
  };
});

describe('npm-config', () => {
  let tempFs: TempFs;
  const mockDetectPackageManager = detectPackageManager as jest.MockedFunction<
    typeof detectPackageManager
  >;
  const mockGetPackageManagerVersion =
    getPackageManagerVersion as jest.MockedFunction<
      typeof getPackageManagerVersion
    >;

  beforeEach(() => {
    tempFs = new TempFs('npm-config');
    mockDetectPackageManager.mockReset();
    mockGetPackageManagerVersion.mockReset();
    mockDetectPackageManager.mockReturnValue('npm');
    mockGetPackageManagerVersion.mockReturnValue('11.0.0');
  });

  describe('isPnpmV11Plus', () => {
    it('should return true for pnpm v11+', () => {
      mockGetPackageManagerVersion.mockReturnValue('11.0.0');
      expect(isPnpmV11Plus(tempFs.tempDir)).toBe(true);
    });

    it('should return false for pnpm v10 and below', () => {
      mockGetPackageManagerVersion.mockReturnValue('10.15.0');
      expect(isPnpmV11Plus(tempFs.tempDir)).toBe(false);
    });

    it('should return false when the pnpm version cannot be determined', () => {
      mockGetPackageManagerVersion.mockImplementation(() => {
        throw new Error('pnpm not found');
      });
      expect(isPnpmV11Plus(tempFs.tempDir)).toBe(false);
    });
  });

  describe('pnpm v11+ config resolution', () => {
    it('should resolve scoped registry via pnpm for pnpm v11+', async () => {
      mockDetectPackageManager.mockReturnValue('pnpm');
      mockGetPackageManagerVersion.mockReturnValue('11.2.1');
      const registry = await getNpmRegistry(tempFs.tempDir, '@scope');
      expect(registry).toEqual('https://pnpm-scoped-registry.com');
    });

    it('should resolve tag via pnpm for pnpm v11+', async () => {
      mockDetectPackageManager.mockReturnValue('pnpm');
      mockGetPackageManagerVersion.mockReturnValue('11.2.1');
      const tag = await getNpmTag(tempFs.tempDir);
      expect(tag).toEqual('pnpm-next');
    });

    it('should resolve registry via npm for pnpm v10 and below', async () => {
      mockDetectPackageManager.mockReturnValue('pnpm');
      mockGetPackageManagerVersion.mockReturnValue('10.15.0');
      const registry = await getNpmRegistry(tempFs.tempDir, '@scope');
      expect(registry).toEqual('https://scoped-registry.com');
    });

    it('should resolve registry via npm for npm workspaces', async () => {
      mockDetectPackageManager.mockReturnValue('npm');
      const registry = await getNpmRegistry(tempFs.tempDir, '@scope');
      expect(registry).toEqual('https://scoped-registry.com');
    });
  });

  describe('getNpmRegistry', () => {
    it('should return scoped registry if it exists', async () => {
      const registry = await getNpmRegistry(tempFs.tempDir, '@scope');
      expect(registry).toEqual('https://scoped-registry.com');
    });

    it('should return registry if scoped registry does not exist', async () => {
      const registry = await getNpmRegistry(tempFs.tempDir, '@missing');
      expect(registry).toEqual('https://custom-registry.com');
    });

    it('should return registry if package is not scoped', async () => {
      const registry = await getNpmRegistry(tempFs.tempDir);
      expect(registry).toEqual('https://custom-registry.com');
    });
  });

  describe('getNpmTag', () => {
    it('should return tag from npm config', async () => {
      const tag = await getNpmTag(tempFs.tempDir);
      expect(tag).toEqual('next');
    });
  });

  describe('parseRegistryOptions', () => {
    let logMessage: string;
    const logFn = (message: string) => {
      logMessage += message;
    };

    beforeEach(() => {
      logMessage = '';
    });

    it('should warn if .npmrc exists in the package root', async () => {
      await tempFs.createFile(
        join('packages', 'pkg1', '.npmrc'),
        'registry=https://custom-registry.com'
      );
      await parseRegistryOptions(
        tempFs.tempDir,
        {
          packageRoot: join(tempFs.tempDir, 'packages', 'pkg1'),
          packageJson: {
            name: 'pkg1',
          } as PackageJson,
        },
        {},
        logFn
      );

      expect(logMessage).toContain(
        'Ignoring .npmrc file detected in the package root'
      );
    });

    it('should warn and return registry set in publishConfig', async () => {
      const { registry, registryConfigKey } = await parseRegistryOptions(
        tempFs.tempDir,
        {
          packageRoot: tempFs.tempDir,
          packageJson: {
            name: 'pkg1',
            publishConfig: {
              registry: 'https://publish-config.com',
            } as PackageJson['publishConfig'],
          } as PackageJson,
        },
        {},
        logFn
      );

      expect(logMessage).toContain("Registry detected in the 'publishConfig'");
      expect(logMessage).toContain(
        'prevents the registry from being overridden'
      );
      expect(registry).toEqual('https://publish-config.com');
      expect(registryConfigKey).toEqual('registry');
    });

    it('should warn and return registry set in publishConfig instead of registry arg', async () => {
      const { registry, registryConfigKey } = await parseRegistryOptions(
        tempFs.tempDir,
        {
          packageRoot: tempFs.tempDir,
          packageJson: {
            name: 'pkg1',
            publishConfig: {
              registry: 'https://publish-config.com',
            } as PackageJson['publishConfig'],
          } as PackageJson,
        },
        {
          registry: 'https://ignored-registry.com',
        },
        logFn
      );

      expect(logMessage).toContain("Registry detected in the 'publishConfig'");
      expect(logMessage).toContain('This will override your registry option');
      expect(registry).toEqual('https://publish-config.com');
      expect(registryConfigKey).toEqual('registry');
    });

    it('should warn and return scoped registry set in publishConfig instead of registry arg for a scoped package', async () => {
      const { registry, registryConfigKey } = await parseRegistryOptions(
        tempFs.tempDir,
        {
          packageRoot: tempFs.tempDir,
          packageJson: {
            name: '@scope/pkg1',
            publishConfig: {
              '@scope:registry': 'https://publish-config.com',
            } as PackageJson['publishConfig'],
          } as PackageJson,
        },
        {
          registry: 'https://ignored-registry.com',
        },
        logFn
      );

      expect(logMessage).toContain("Registry detected in the 'publishConfig'");
      expect(registry).toContain('https://publish-config.com');
      expect(registryConfigKey).toEqual('@scope:registry');
    });

    it('should warn if registry is set in publishConfig for a scoped package, but still return registry arg', async () => {
      const { registry, registryConfigKey } = await parseRegistryOptions(
        tempFs.tempDir,
        {
          packageRoot: tempFs.tempDir,
          packageJson: {
            name: '@scope/pkg1',
            publishConfig: {
              registry: 'https://publish-config.com',
            } as PackageJson['publishConfig'],
          } as PackageJson,
        },
        {
          registry: 'https://registry-arg.com',
        },
        logFn
      );

      expect(logMessage).toContain("Registry detected in the 'publishConfig'");
      expect(registry).toContain('https://registry-arg.com');
      expect(registryConfigKey).toEqual('@scope:registry');
    });

    it('should return registry arg over npm config', async () => {
      const { registry, registryConfigKey } = await parseRegistryOptions(
        tempFs.tempDir,
        {
          packageRoot: tempFs.tempDir,
          packageJson: {
            name: 'pkg1',
          } as PackageJson,
        },
        {
          registry: 'https://registry-arg.com',
        },
        logFn
      );

      expect(registry).toEqual('https://registry-arg.com');
      expect(registryConfigKey).toEqual('registry');
    });

    it('should return registry arg over npm config for scoped packages', async () => {
      const { registry, registryConfigKey } = await parseRegistryOptions(
        tempFs.tempDir,
        {
          packageRoot: tempFs.tempDir,
          packageJson: {
            name: '@scope/pkg1',
          } as PackageJson,
        },
        {
          registry: 'https://registry-arg.com',
        },
        logFn
      );

      expect(registry).toEqual('https://registry-arg.com');
      expect(registryConfigKey).toEqual('@scope:registry');
    });

    it('should defer to npm config for scoped registry', async () => {
      const { registry, registryConfigKey } = await parseRegistryOptions(
        tempFs.tempDir,
        {
          packageRoot: tempFs.tempDir,
          packageJson: {
            name: '@scope/pkg1',
          } as PackageJson,
        },
        {},
        logFn
      );

      expect(registry).toEqual('https://scoped-registry.com');
      expect(registryConfigKey).toEqual('@scope:registry');
    });

    it('should defer to npm config for registry if scoped registry does not exist', async () => {
      const { registry, registryConfigKey } = await parseRegistryOptions(
        tempFs.tempDir,
        {
          packageRoot: tempFs.tempDir,
          packageJson: {
            name: '@missing/pkg1',
          } as PackageJson,
        },
        {},
        logFn
      );

      expect(registry).toEqual('https://custom-registry.com');
      expect(registryConfigKey).toEqual('@missing:registry');
    });

    it('should defer to npm config for registry if package is not scoped', async () => {
      const { registry, registryConfigKey } = await parseRegistryOptions(
        tempFs.tempDir,
        {
          packageRoot: tempFs.tempDir,
          packageJson: {
            name: 'pkg1',
          } as PackageJson,
        },
        {},
        logFn
      );

      expect(registry).toEqual('https://custom-registry.com');
      expect(registryConfigKey).toEqual('registry');
    });

    it('should return npm tag from config', async () => {
      const { tag } = await parseRegistryOptions(
        tempFs.tempDir,
        {
          packageRoot: tempFs.tempDir,
          packageJson: {
            name: 'pkg1',
          } as PackageJson,
        },
        {},
        logFn
      );

      expect(tag).toEqual('next');
    });

    it('should override npm tag when tag option is passed', async () => {
      const { tag } = await parseRegistryOptions(
        tempFs.tempDir,
        {
          packageRoot: tempFs.tempDir,
          packageJson: {
            name: 'pkg1',
          } as PackageJson,
        },
        {
          tag: 'alpha',
        },
        logFn
      );

      expect(tag).toEqual('alpha');
    });
  });
});
