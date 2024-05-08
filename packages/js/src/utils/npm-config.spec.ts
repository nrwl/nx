import { ExecException } from 'child_process';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { PackageJson } from 'nx/src/utils/package-json';
import { join } from 'path';
import { getNpmRegistry, getNpmTag, parseRegistryOptions } from './npm-config';

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

  beforeEach(() => {
    tempFs = new TempFs('npm-config');
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
