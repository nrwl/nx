import { tmpdir } from 'os';
import { join } from 'path';
import * as fs from 'fs';
import { ensureNodeModulesSymlink } from './ensure-node-modules-symlink';

const workspaceDir = join(tmpdir(), 'nx-react-native-test');
const appDir = 'apps/myapp';
const appDirAbsolutePath = join(workspaceDir, appDir);

describe('ensureNodeModulesSymlink', () => {
  beforeEach(() => {
    if (fs.existsSync(workspaceDir))
      fs.rmdirSync(workspaceDir, { recursive: true });
    fs.mkdirSync(workspaceDir);
    fs.mkdirSync(appDirAbsolutePath, { recursive: true });
    fs.mkdirSync(appDirAbsolutePath, { recursive: true });
    fs.writeFileSync(
      join(appDirAbsolutePath, 'package.json'),
      JSON.stringify({
        name: 'myapp',
        dependencies: { 'react-native': '*' },
      })
    );
    fs.writeFileSync(
      join(workspaceDir, 'package.json'),
      JSON.stringify({
        name: 'workspace',
        dependencies: {
          '@nrwl/react-native': '9999.9.9',
          '@react-native-community/cli-platform-ios': '7777.7.7',
          '@react-native-community/cli-platform-android': '7777.7.7',
          'react-native': '0.9999.0',
        },
      })
    );
  });

  afterEach(() => {
    if (fs.existsSync(workspaceDir))
      fs.rmdirSync(workspaceDir, { recursive: true });
  });

  it('should create symlinks', () => {
    createNpmDirectory('@nrwl/react-native', '9999.9.9');
    createNpmDirectory(
      '@react-native-community/cli-platform-android',
      '7777.7.7'
    );
    createNpmDirectory('@react-native-community/cli-platform-ios', '7777.7.7');
    createNpmDirectory('hermes-engine', '3333.3.3');
    createNpmDirectory('react-native', '0.9999.0');
    createNpmDirectory('jsc-android', '888888.0.0');
    createNpmDirectory('@babel/runtime', '5555.0.0');

    ensureNodeModulesSymlink(workspaceDir, appDir);

    expectSymlinkToExist('@nrwl/react-native');
    expectSymlinkToExist('react-native');
    expectSymlinkToExist('jsc-android');
    expectSymlinkToExist('hermes-engine');
    expectSymlinkToExist('@react-native-community/cli-platform-ios');
    expectSymlinkToExist('@react-native-community/cli-platform-android');
    expectSymlinkToExist('@babel/runtime');
  });

  it('should add packages listed in workspace package.json', () => {
    fs.writeFileSync(
      join(workspaceDir, 'package.json'),
      JSON.stringify({
        name: 'workspace',
        dependencies: {
          random: '9999.9.9',
        },
      })
    );
    createNpmDirectory('@nrwl/react-native', '9999.9.9');
    createNpmDirectory(
      '@react-native-community/cli-platform-android',
      '7777.7.7'
    );
    createNpmDirectory('@react-native-community/cli-platform-ios', '7777.7.7');
    createNpmDirectory('hermes-engine', '3333.3.3');
    createNpmDirectory('react-native', '0.9999.0');
    createNpmDirectory('jsc-android', '888888.0.0');
    createNpmDirectory('@babel/runtime', '5555.0.0');
    createNpmDirectory('random', '9999.9.9');

    ensureNodeModulesSymlink(workspaceDir, appDir);

    expectSymlinkToExist('random');
  });

  it('should support pnpm', () => {
    createPnpmDirectory('@nrwl/react-native', '9999.9.9');
    createPnpmDirectory(
      '@react-native-community/cli-platform-android',
      '7777.7.7'
    );
    createPnpmDirectory('@react-native-community/cli-platform-ios', '7777.7.7');
    createPnpmDirectory('hermes-engine', '3333.3.3');
    createPnpmDirectory('react-native', '0.9999.0');
    createPnpmDirectory('jsc-android', '888888.0.0');
    createPnpmDirectory('@babel/runtime', '5555.0.0');

    ensureNodeModulesSymlink(workspaceDir, appDir);

    expectSymlinkToExist('react-native');
    expectSymlinkToExist('jsc-android');
    expectSymlinkToExist('hermes-engine');
    expectSymlinkToExist('@react-native-community/cli-platform-ios');
    expectSymlinkToExist('@react-native-community/cli-platform-android');
    expectSymlinkToExist('@babel/runtime');
  });

  it('should support pnpm with multiple react-native versions', () => {
    createPnpmDirectory('@nrwl/react-native', '9999.9.9');
    createPnpmDirectory(
      '@react-native-community/cli-platform-android',
      '7777.7.7'
    );
    createPnpmDirectory('@react-native-community/cli-platform-ios', '7777.7.7');
    createPnpmDirectory('hermes-engine', '3333.3.3');
    createPnpmDirectory('react-native', '0.9999.0');
    createPnpmDirectory('react-native', '0.59.1');
    createPnpmDirectory('jsc-android', '888888.0.0');
    createPnpmDirectory('@babel/runtime', '5555.0.0');

    ensureNodeModulesSymlink(workspaceDir, appDir);

    expectSymlinkToExist('react-native');
    expectSymlinkToExist('jsc-android');
    expectSymlinkToExist('hermes-engine');
    expectSymlinkToExist('@react-native-community/cli-platform-ios');
    expectSymlinkToExist('@react-native-community/cli-platform-android');
    expectSymlinkToExist('@babel/runtime');
  });

  it('should throw error if pnpm package cannot be matched', () => {
    createPnpmDirectory('@nrwl/react-native', '9999.9.9');
    createPnpmDirectory(
      '@react-native-community/cli-platform-android',
      '7777.7.7'
    );
    createPnpmDirectory('@react-native-community/cli-platform-ios', '7777.7.7');
    createPnpmDirectory('hermes-engine', '3333.3.3');
    createPnpmDirectory('jsc-android', '888888.0.0');
    createPnpmDirectory('react-native', '0.60.1');
    createPnpmDirectory('react-native', '0.59.1');
    createPnpmDirectory('@babel/runtime', '5555.0.0');

    expect(() => {
      ensureNodeModulesSymlink(workspaceDir, appDir);
    }).toThrow(/Cannot find/);
  });

  function createPnpmDirectory(packageName, version) {
    const dir = join(
      workspaceDir,
      `node_modules/.pnpm/${packageName.replace(
        '/',
        '+'
      )}@${version}/node_modules/${packageName}`
    );
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: packageName, version: version })
    );
    return dir;
  }

  function createNpmDirectory(packageName, version) {
    const dir = join(workspaceDir, `node_modules/${packageName}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: packageName, version: version })
    );
    return dir;
  }

  function expectSymlinkToExist(packageName) {
    expect(
      fs.existsSync(
        join(appDirAbsolutePath, `node_modules/${packageName}/package.json`)
      )
    ).toBe(true);
  }
});
