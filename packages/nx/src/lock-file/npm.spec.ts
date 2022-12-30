import {
  parseNpmLockFile,
  pruneNpmLockFile,
  stringifyNpmLockFile,
} from './npm';
import {
  lockFileV1,
  lockFileV1JustTypescript,
  lockFileV1YargsAndDevkitOnly,
  lockFileV2,
  lockFileV2JustTypescript,
  lockFileV2YargsAndDevkitOnly,
  lockFileV3,
  lockFileV3JustTypescript,
  lockFileV3YargsAndDevkitOnly,
  rxjsTslibLockFileV1,
  rxjsTslibLockFileV2,
  rxjsTslibLockFileV3,
  ssh2LockFileV1,
  ssh2LockFileV2,
  ssh2LockFileV3,
} from './__fixtures__/npm.lock';
import { vol } from 'memfs';
import { npmLockFileWithWorkspaces } from './__fixtures__/workspaces.lock';

jest.mock('fs', () => require('memfs').fs);

jest.mock('@nrwl/devkit', () => ({
  ...jest.requireActual<any>('@nrwl/devkit'),
  workspaceRoot: '/root',
}));

jest.mock('nx/src/utils/workspace-root', () => ({
  workspaceRoot: '/root',
}));

const TypeScriptOnlyPackage = {
  name: 'test',
  version: '0.0.0',
  dependencies: { typescript: '4.8.4' },
};
const YargsAndDevkitPackage = {
  name: 'test',
  version: '0.0.0',
  dependencies: { '@nrwl/devkit': '15.0.13', yargs: '17.6.2' },
};
const Ssh2Package = {
  name: 'test',
  version: '0.0.0',
  dependencies: {
    ssh2: '1.11.0',
  },
};
const RxjsTslibPackage = {
  name: 'test',
  version: '0.0.0',
  dependencies: {
    rxjs: '^7.8.0',
    tslib: '^2.4.1',
  },
};

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
      expect(JSON.parse(stringifyNpmLockFile(parsedLockFile))).toEqual(
        JSON.parse(lockFileV3)
      );
    });

    it('should prune the lock file', () => {
      expect(
        Object.keys(
          pruneNpmLockFile(parsedLockFile, TypeScriptOnlyPackage).dependencies
        ).length
      ).toEqual(1);
      expect(
        Object.keys(
          pruneNpmLockFile(parsedLockFile, YargsAndDevkitPackage).dependencies
        ).length
      ).toEqual(136);
    });

    it('should correctly prune lockfile with single package', () => {
      expect(
        JSON.parse(
          stringifyNpmLockFile(
            pruneNpmLockFile(parsedLockFile, TypeScriptOnlyPackage)
          )
        )
      ).toEqual(JSON.parse(lockFileV3JustTypescript));
    });

    it('should correctly prune lockfile with multiple packages', () => {
      expect(
        JSON.parse(
          stringifyNpmLockFile(
            pruneNpmLockFile(parsedLockFile, YargsAndDevkitPackage)
          )
        )
      ).toEqual(JSON.parse(lockFileV3YargsAndDevkitOnly));
    });

    it('should correctly prune lockfile with package that has optional dependencies', () => {
      expect(
        stringifyNpmLockFile(
          pruneNpmLockFile(parseNpmLockFile(ssh2LockFileV3), Ssh2Package)
        )
      ).toEqual(ssh2LockFileV3);
    });

    it('should correctly prune lockfile with packages in multiple versions', () => {
      expect(
        stringifyNpmLockFile(
          pruneNpmLockFile(
            parseNpmLockFile(rxjsTslibLockFileV3),
            RxjsTslibPackage
          )
        )
      ).toEqual(rxjsTslibLockFileV3);
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

    it('should parse lockfile with workspaces correctly', () => {
      const parsedWorkspaceLockFile = parseNpmLockFile(
        npmLockFileWithWorkspaces
      );
      expect(JSON.parse(stringifyNpmLockFile(parsedWorkspaceLockFile))).toEqual(
        JSON.parse(npmLockFileWithWorkspaces)
      );
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
      expect(JSON.parse(stringifyNpmLockFile(parsedLockFile))).toEqual(
        JSON.parse(lockFileV2)
      );
    });

    it('should prune the lock file', () => {
      expect(
        Object.keys(
          pruneNpmLockFile(parsedLockFile, TypeScriptOnlyPackage).dependencies
        ).length
      ).toEqual(1);
      expect(
        Object.keys(
          pruneNpmLockFile(parsedLockFile, YargsAndDevkitPackage).dependencies
        ).length
      ).toEqual(136);
    });

    it('should correctly prune lockfile with single package', () => {
      expect(
        JSON.parse(
          stringifyNpmLockFile(
            pruneNpmLockFile(parsedLockFile, TypeScriptOnlyPackage)
          )
        )
      ).toEqual(JSON.parse(lockFileV2JustTypescript));
    });

    it('should correctly prune lockfile with multiple packages', () => {
      const pruned = pruneNpmLockFile(parsedLockFile, YargsAndDevkitPackage);
      expect(JSON.parse(stringifyNpmLockFile(pruned))).toEqual(
        JSON.parse(lockFileV2YargsAndDevkitOnly)
      );
    });

    it('should correctly prune lockfile with package that has optional dependencies', () => {
      expect(
        stringifyNpmLockFile(
          pruneNpmLockFile(parseNpmLockFile(ssh2LockFileV2), Ssh2Package)
        )
      ).toEqual(ssh2LockFileV2);
    });

    it('should correctly prune lockfile with packages in multiple versions', () => {
      expect(
        stringifyNpmLockFile(
          pruneNpmLockFile(
            parseNpmLockFile(rxjsTslibLockFileV2),
            RxjsTslibPackage
          )
        )
      ).toEqual(rxjsTslibLockFileV2);
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
      expect(JSON.parse(stringifyNpmLockFile(parsedLockFile))).toEqual(
        JSON.parse(lockFileV1)
      );
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
            pruneNpmLockFile(parsedLockFile, TypeScriptOnlyPackage).dependencies
          ).length
        ).toEqual(1);
        expect(
          Object.keys(
            pruneNpmLockFile(parsedLockFile, YargsAndDevkitPackage).dependencies
          ).length
        ).toEqual(136);
      });

      it('should correctly prune lockfile with single package', () => {
        expect(
          JSON.parse(
            stringifyNpmLockFile(
              pruneNpmLockFile(parsedLockFile, TypeScriptOnlyPackage)
            )
          )
        ).toEqual(JSON.parse(lockFileV1JustTypescript));
      });

      it('should correctly prune lockfile with multiple packages', () => {
        const pruned = pruneNpmLockFile(parsedLockFile, YargsAndDevkitPackage);
        expect(JSON.parse(stringifyNpmLockFile(pruned))).toEqual(
          JSON.parse(lockFileV1YargsAndDevkitOnly)
        );
      });

      it('should correctly prune lockfile with package that has optional dependencies', () => {
        expect(
          stringifyNpmLockFile(
            pruneNpmLockFile(parseNpmLockFile(ssh2LockFileV1), Ssh2Package)
          )
        ).toEqual(ssh2LockFileV1);
      });

      it('should correctly prune lockfile with packages in multiple versions', () => {
        expect(
          stringifyNpmLockFile(
            pruneNpmLockFile(
              parseNpmLockFile(rxjsTslibLockFileV1),
              RxjsTslibPackage
            )
          )
        ).toEqual(rxjsTslibLockFileV1);
      });
    });
  });
});
