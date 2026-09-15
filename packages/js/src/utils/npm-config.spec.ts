import { join } from 'path';
import { getNpmRegistry, getNpmTag, parseRegistryOptions } from './npm-config';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { PackageJson, safeSpawn } from '@nx/devkit/internal';

jest.mock('@nx/devkit/internal', () => {
  const { EventEmitter } = require('events');
  const { PassThrough } = require('stream');
  const CONFIG_VALUES: Record<string, string> = {
    '@scope:registry': 'https://scoped-registry.com',
    '@missing:registry': 'undefined',
    registry: 'https://custom-registry.com',
    tag: 'next',
  };

  return {
    ...jest.requireActual('@nx/devkit/internal'),
    safeSpawn: jest.fn((binary: string, args: string[]) => {
      const child: any = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();

      const [subcommand, action, key] = args;
      const value =
        binary === 'npm' && subcommand === 'config' && action === 'get'
          ? CONFIG_VALUES[key]
          : undefined;

      process.nextTick(() => {
        child.stdout.end(value === undefined ? '' : `${value}\n`);
        child.stderr.end(value === undefined ? 'ERROR' : '');
        setImmediate(() => child.emit('close', value === undefined ? 1 : 0));
      });

      return child;
    }),
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

    it('should pass a scope carrying shell syntax to npm as a single argv element', async () => {
      // the scope comes from the package's own manifest name
      const scope = '@evil$(touch NX_PWNED)';

      await getNpmRegistry(tempFs.tempDir, scope);

      expect(safeSpawn).toHaveBeenCalledWith(
        'npm',
        ['config', 'get', `${scope}:registry`],
        expect.anything()
      );
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
