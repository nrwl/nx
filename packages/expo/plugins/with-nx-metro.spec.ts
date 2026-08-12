import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('withNxMetro', () => {
  let testWorkspaceRoot: string;

  beforeEach(() => {
    testWorkspaceRoot = mkdtempSync(join(tmpdir(), 'nx-expo-metro-'));
  });

  afterEach(() => {
    jest.dontMock('@nx/devkit');
    jest.resetModules();
    rmSync(testWorkspaceRoot, { recursive: true, force: true });
  });

  it('keeps Metro config and resolver families separate across apps', () => {
    const legacyAppRoot = join(testWorkspaceRoot, 'apps', 'legacy');
    const modernAppRoot = join(testWorkspaceRoot, 'apps', 'modern');
    mkdirSync(join(legacyAppRoot, 'node_modules'), { recursive: true });
    mkdirSync(modernAppRoot, { recursive: true });

    createPackage(testWorkspaceRoot, 'expo', '54.0.0');
    createPackage(testWorkspaceRoot, 'metro-config', '0.82.0', {
      'index.js': metroConfigModule('standalone-54'),
    });
    createPackage(testWorkspaceRoot, 'metro-resolver', '0.82.0', {
      'index.js': metroResolverModule('standalone-54'),
    });
    createPackage(testWorkspaceRoot, '@expo/metro', '57.0.0', {
      'metro-config.js': metroConfigModule('hoisted-expo-metro'),
      'metro-resolver.js': metroResolverModule('hoisted-expo-metro'),
    });

    createPackage(modernAppRoot, 'expo', '57.0.0');
    createPackage(modernAppRoot, '@expo/metro', '57.0.0', {
      'metro-config.js': metroConfigModule('expo-57'),
      'metro-resolver.js': metroResolverModule('expo-57'),
    });

    jest.resetModules();
    jest.doMock('@nx/devkit', () => ({ workspaceRoot: testWorkspaceRoot }));
    const { withNxMetro } =
      require('./with-nx-metro') as typeof import('./with-nx-metro');

    const legacyConfig = withNxMetro({
      projectRoot: legacyAppRoot,
      resolver: {},
    });
    const modernConfig = withNxMetro({
      projectRoot: modernAppRoot,
      resolver: {},
    });
    const legacyConfigAgain = withNxMetro({
      projectRoot: legacyAppRoot,
      resolver: {},
    });

    expect(legacyConfig.projectRoot).toBe(testWorkspaceRoot);
    expect(modernConfig.projectRoot).toBe(modernAppRoot);
    expect(legacyConfig.metroConfigFamily).toBe('standalone-54');
    expect(modernConfig.metroConfigFamily).toBe('expo-57');
    expect(legacyConfigAgain.metroConfigFamily).toBe('standalone-54');
    expect(resolveWith(legacyConfig, legacyAppRoot)).toEqual({
      type: 'sourceFile',
      filePath: 'standalone-54:fixture-module',
    });
    expect(resolveWith(modernConfig, modernAppRoot)).toEqual({
      type: 'sourceFile',
      filePath: 'expo-57:fixture-module',
    });
    expect(resolveWith(legacyConfigAgain, legacyAppRoot)).toEqual({
      type: 'sourceFile',
      filePath: 'standalone-54:fixture-module',
    });
  });
});

function createPackage(
  root: string,
  name: string,
  version: string,
  files: Record<string, string> = {}
) {
  const packageRoot = join(root, 'node_modules', ...name.split('/'));
  mkdirSync(packageRoot, { recursive: true });
  writeFileSync(
    join(packageRoot, 'package.json'),
    JSON.stringify({ name, version })
  );
  for (const [file, contents] of Object.entries(files)) {
    writeFileSync(join(packageRoot, file), contents);
  }
}

function metroConfigModule(family: string) {
  return `module.exports = {
  mergeConfig(userConfig, nxConfig) {
    return {
      ...userConfig,
      ...nxConfig,
      resolver: { ...userConfig.resolver, ...nxConfig.resolver },
      metroConfigFamily: ${JSON.stringify(family)},
    };
  },
};`;
}

function metroResolverModule(family: string) {
  return `exports.resolve = (_context, moduleName) => ({
  type: 'sourceFile',
  filePath: ${JSON.stringify(family)} + ':' + moduleName,
});`;
}

function resolveWith(config: any, appRoot: string) {
  return config.resolver.resolveRequest(
    {
      originModulePath: join(appRoot, 'index.js'),
      resolveRequest() {
        throw new Error('Use the Metro resolver');
      },
    },
    'fixture-module',
    'ios'
  );
}
