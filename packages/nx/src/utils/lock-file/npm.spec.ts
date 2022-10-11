import { parseNpmLockFile, stringifyNpmLockFile } from './npm';
import { lockFile, lockFileV1 } from './__fixtures__/npm.lock';

describe('npm LockFile utility', () => {
  describe('v2', () => {
    const parsedLockFile = parseNpmLockFile(lockFile);

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
      expect(Object.keys(parsedLockFile.dependencies).length).toEqual(324);
      expect(
        parsedLockFile.dependencies['@ampproject/remapping']
      ).toMatchSnapshot();
      expect(parsedLockFile.dependencies['typescript']).toMatchSnapshot();
    });

    it('should map various versions of packages', () => {
      expect(
        Object.keys(parsedLockFile.dependencies['@jridgewell/gen-mapping'])
          .length
      ).toEqual(2);
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.1.1'
        ]
      ).toBeDefined();
      // This is opposite from yarn and pnpm
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.1.1'
        ].rootVersion
      ).toBeTruthy();
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.3.2'
        ]
      ).toBeDefined();
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.3.2'
        ].rootVersion
      ).toBeFalsy();
    });

    it('should map various instances of the same version', () => {
      const jestResolveDependency =
        parsedLockFile.dependencies['jest-resolve']['jest-resolve@28.1.3'];
      expect(jestResolveDependency.packageMeta.length).toEqual(2);
      expect((jestResolveDependency.packageMeta[0] as any).path).toEqual(
        'node_modules/jest-runner/node_modules/jest-resolve'
      );
      expect((jestResolveDependency.packageMeta[1] as any).path).toEqual(
        'node_modules/jest-runtime/node_modules/jest-resolve'
      );
    });

    it('should map optional field', () => {
      const tsDependency =
        parsedLockFile.dependencies['typescript']['typescript@4.8.3'];
      expect((tsDependency.packageMeta[0] as any).optional).toBeFalsy();
      const fsEventsDependency =
        parsedLockFile.dependencies['fsevents']['fsevents@2.3.2'];
      expect((fsEventsDependency.packageMeta[0] as any).optional).toBeTruthy();
    });

    it('should match the original file on stringification', () => {
      expect(stringifyNpmLockFile(parsedLockFile)).toEqual(lockFile);
    });
  });

  describe('v1', () => {
    const parsedLockFile = parseNpmLockFile(lockFileV1);

    it('should parse lockfile correctly', () => {
      expect(parsedLockFile.lockFileMetadata).toEqual({
        metadata: {
          lockfileVersion: 1,
          name: 'test',
          requires: true,
          version: '0.0.0',
        },
      });
      expect(Object.keys(parsedLockFile.dependencies).length).toEqual(324);
      expect(
        parsedLockFile.dependencies['@ampproject/remapping']
      ).toMatchSnapshot();
      expect(parsedLockFile.dependencies['typescript']).toMatchSnapshot();
    });

    it('should map various versions of packages', () => {
      expect(
        Object.keys(parsedLockFile.dependencies['@jridgewell/gen-mapping'])
          .length
      ).toEqual(2);
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.1.1'
        ]
      ).toBeDefined();
      // This is opposite from yarn and pnpm
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.1.1'
        ].rootVersion
      ).toBeTruthy();
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.3.2'
        ]
      ).toBeDefined();
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.3.2'
        ].rootVersion
      ).toBeFalsy();
    });

    it('should map various instances of the same version', () => {
      const jestResolveDependency =
        parsedLockFile.dependencies['jest-resolve']['jest-resolve@28.1.3'];
      expect(jestResolveDependency.packageMeta.length).toEqual(2);
      expect((jestResolveDependency.packageMeta[0] as any).path).toEqual(
        'node_modules/jest-runner/node_modules/jest-resolve'
      );
      expect((jestResolveDependency.packageMeta[1] as any).path).toEqual(
        'node_modules/jest-runtime/node_modules/jest-resolve'
      );
    });

    it('should map optional field', () => {
      const tsDependency =
        parsedLockFile.dependencies['typescript']['typescript@4.8.4'];
      expect((tsDependency.packageMeta[0] as any).optional).toBeFalsy();
      const fsEventsDependency =
        parsedLockFile.dependencies['fsevents']['fsevents@2.3.2'];
      expect((fsEventsDependency.packageMeta[0] as any).optional).toBeTruthy();
    });

    it('should match the original file on stringification', () => {
      expect(stringifyNpmLockFile(parsedLockFile)).toEqual(lockFileV1);
    });
  });
});
