import { parseLockFile, stringifyLockFile } from './npm';
import { lockFile } from './__fixtures__/npm.lock';

describe('npm LockFile utility', () => {
  const parsedLockFile = parseLockFile(lockFile);

  it('should parse lockfile correctly', () => {
    expect(parsedLockFile.lockFileMetadata).toEqual({
      metadata: {
        lockfileVersion: 2,
        name: 'test',
        requires: true,
        version: '0.0.0',
      },
      rootPackage: {
        devDependencies: {
          '@nrwl/cli': '14.7.5',
          '@nrwl/workspace': '14.7.5',
          nx: '14.7.5',
          prettier: '^2.6.2',
          typescript: '~4.8.2',
        },
        license: 'MIT',
        name: 'test',
        version: '0.0.0',
      },
    });
    expect(Object.keys(parsedLockFile.dependencies).length).toEqual(349);
    expect(
      parsedLockFile.dependencies['@ampproject/remapping@2.2.0']
    ).toMatchSnapshot();
    expect(parsedLockFile.dependencies['typescript@4.8.3']).toMatchSnapshot();
  });

  it('should map various versions of packages', () => {
    expect(
      parsedLockFile.dependencies['@jridgewell/gen-mapping@0.1.1']
    ).toBeDefined();
    expect(
      parsedLockFile.dependencies['@jridgewell/gen-mapping@0.3.2']
    ).toBeDefined();
  });

  it('should map various instances of the same version', () => {
    expect(
      parsedLockFile.dependencies['jest-resolve@28.1.3'].packageMeta.length
    ).toEqual(2);
    expect(
      parsedLockFile.dependencies['jest-resolve@28.1.3'].packageMeta[0].path
    ).toEqual('node_modules/jest-runner/node_modules/jest-resolve');
    expect(
      parsedLockFile.dependencies['jest-resolve@28.1.3'].packageMeta[1].path
    ).toEqual('node_modules/jest-runtime/node_modules/jest-resolve');
  });

  it('should map optional field', () => {
    expect(
      parsedLockFile.dependencies['typescript@4.8.3'].packageMeta[0].optional
    ).toBeFalsy();
    expect(
      parsedLockFile.dependencies['fsevents@2.3.2'].packageMeta[0].optional
    ).toBeTruthy();
  });

  it('should match the original file on stringification', () => {
    expect(stringifyLockFile(parsedLockFile)).toEqual(lockFile);
  });
});
