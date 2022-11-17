import {
  parseNpmLockFile,
  pruneNpmLockFile,
  stringifyNpmLockFile,
} from './npm';
import {
  lockFileV2,
  lockFileV1,
  lockFileV3,
  lockFileV3JustTypescript,
  lockFileV3YargsAndDevkitOnly,
  lockFileV2JustTypescript,
  lockFileV1JustTypescript,
  lockFileV1YargsAndDevkitOnly,
  lockFileV2YargsAndDevkitOnly,
} from './__fixtures__/npm.lock';
import { vol } from 'memfs';
import { readJsonFile } from '../fileutils';

jest.mock('fs', () => require('memfs').fs);

jest.mock('@nrwl/devkit', () => ({
  ...jest.requireActual<any>('@nrwl/devkit'),
  workspaceRoot: '/root',
}));

jest.mock('nx/src/utils/workspace-root', () => ({
  workspaceRoot: '/root',
}));

describe('npm LockFile utility', () => {
  describe('v3', () => {
    const parsedLockFile = parseNpmLockFile(lockFileV3);

    it('should parse lockfile correctly', () => {
      expect(parsedLockFile.lockFileMetadata).toEqual({
        metadata: {
          lockfileVersion: 3,
          name: 'test',
          requires: true,
          version: '0.0.0',
        },
        rootPackage: {
          devDependencies: {
            '@nrwl/cli': '15.0.13',
            '@nrwl/workspace': '15.0.13',
            nx: '15.0.13',
            prettier: '^2.6.2',
            typescript: '~4.8.2',
          },
          license: 'MIT',
          name: 'test',
          version: '0.0.0',
        },
      });
      expect(Object.keys(parsedLockFile.dependencies).length).toEqual(339);
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
      expect(stringifyNpmLockFile(parsedLockFile)).toEqual(lockFileV3);
    });

    it('should prune the lock file', () => {
      expect(
        Object.keys(
          pruneNpmLockFile(parsedLockFile, ['typescript']).dependencies
        ).length
      ).toEqual(1);
      expect(
        Object.keys(
          pruneNpmLockFile(parsedLockFile, ['yargs', '@nrwl/devkit'])
            .dependencies
        ).length
      ).toEqual(136);
    });

    it('should correctly prune lockfile with single package', () => {
      expect(
        stringifyNpmLockFile(pruneNpmLockFile(parsedLockFile, ['typescript']))
      ).toEqual(lockFileV3JustTypescript);
    });

    it('should correctly prune lockfile with multiple packages', () => {
      expect(
        stringifyNpmLockFile(
          pruneNpmLockFile(parsedLockFile, ['yargs', '@nrwl/devkit'])
        )
      ).toEqual(lockFileV3YargsAndDevkitOnly);
    });
  });

  describe('v2', () => {
    const parsedLockFile = parseNpmLockFile(lockFileV2);

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
            '@nrwl/cli': '15.0.13',
            '@nrwl/workspace': '15.0.13',
            nx: '15.0.13',
            prettier: '^2.6.2',
            typescript: '~4.8.2',
          },
          license: 'MIT',
          name: 'test',
          version: '0.0.0',
        },
      });
      expect(Object.keys(parsedLockFile.dependencies).length).toEqual(339);
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
      expect(stringifyNpmLockFile(parsedLockFile)).toEqual(lockFileV2);
    });

    it('should prune the lock file', () => {
      expect(
        Object.keys(
          pruneNpmLockFile(parsedLockFile, ['typescript']).dependencies
        ).length
      ).toEqual(1);
      expect(
        Object.keys(
          pruneNpmLockFile(parsedLockFile, ['yargs', '@nrwl/devkit'])
            .dependencies
        ).length
      ).toEqual(136);
    });

    it('should correctly prune lockfile with single package', () => {
      expect(
        stringifyNpmLockFile(pruneNpmLockFile(parsedLockFile, ['typescript']))
      ).toEqual(lockFileV2JustTypescript);
    });

    it('should correctly prune lockfile with multiple packages', () => {
      const pruned = pruneNpmLockFile(parsedLockFile, [
        'yargs',
        '@nrwl/devkit',
      ]);
      expect(stringifyNpmLockFile(pruned)).toEqual(
        lockFileV2YargsAndDevkitOnly
      );
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
      expect(Object.keys(parsedLockFile.dependencies).length).toEqual(339);
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

    describe('pruning', () => {
      beforeAll(() => {
        const v2packages = JSON.parse(lockFileV2).packages;
        const fileSys = {};
        // map all v2 packages to the file system
        Object.keys(v2packages).forEach((key) => {
          if (key) {
            fileSys[`/root/${key}/package.json`] = JSON.stringify(
              v2packages[key]
            );
          }
        });
        vol.fromJSON(fileSys, '/root');
      });

      it('should prune the lock file', () => {
        expect(
          Object.keys(
            pruneNpmLockFile(parsedLockFile, ['typescript']).dependencies
          ).length
        ).toEqual(1);
        expect(
          Object.keys(
            pruneNpmLockFile(parsedLockFile, ['yargs', '@nrwl/devkit'])
              .dependencies
          ).length
        ).toEqual(136);
      });

      it('should correctly prune lockfile with single package', () => {
        expect(
          stringifyNpmLockFile(pruneNpmLockFile(parsedLockFile, ['typescript']))
        ).toEqual(lockFileV1JustTypescript);
      });

      it('should correctly prune lockfile with multiple packages', () => {
        expect(
          stringifyNpmLockFile(
            pruneNpmLockFile(parsedLockFile, ['yargs', '@nrwl/devkit'])
          )
        ).toEqual(lockFileV1YargsAndDevkitOnly);
      });
    });
  });
});
