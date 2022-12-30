import {
  parsePnpmLockFile,
  prunePnpmLockFile,
  stringifyPnpmLockFile,
} from './pnpm';
import {
  lockFile,
  lockFileJustTypescript,
  lockFileWithInlineSpecifiers,
  lockFileYargsAndDevkit,
  rxjsTslibLockFile,
  ssh2LockFile,
} from './__fixtures__/pnpm.lock';
import {
  pnpmLockFileWithInlineSpecifiersAndWorkspaces,
  pnpmLockFileWithWorkspacesAndTime,
} from './__fixtures__/workspaces.lock';

const TypeScriptOnlyPackage = {
  name: 'test',
  version: '1.0.0',
  dependencies: { typescript: '4.8.4' },
};
const YargsAndDevkitPackage = {
  name: 'test',
  version: '1.2.3',
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

describe('pnpm LockFile utility', () => {
  describe('standard lock file', () => {
    const parsedLockFile = parsePnpmLockFile(lockFile);

    it('should parse lockfile correctly', () => {
      expect(parsedLockFile.lockFileMetadata).toEqual({ lockfileVersion: 5.4 });
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
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.1.1'
        ].rootVersion
      ).toBeFalsy();
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.3.2'
        ]
      ).toBeDefined();
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.3.2'
        ].rootVersion
      ).toBeTruthy();
    });

    it('should map various instances of the same version', () => {
      const jestResolveDependency =
        parsedLockFile.dependencies['jest-pnp-resolver'][
          'jest-pnp-resolver@1.2.3'
        ];

      expect(jestResolveDependency.packageMeta.length).toEqual(2);
      expect((jestResolveDependency.packageMeta[0] as any).key).toEqual(
        '/jest-pnp-resolver/1.2.3_jest-resolve@28.1.1'
      );
      expect((jestResolveDependency.packageMeta[1] as any).key).toEqual(
        '/jest-pnp-resolver/1.2.3_jest-resolve@28.1.3'
      );

      expect(
        (jestResolveDependency.packageMeta[0] as any).dependencyDetails
          .dependencies
      ).toEqual({ 'jest-resolve': '28.1.1' });
      expect(
        (jestResolveDependency.packageMeta[1] as any).dependencyDetails
          .dependencies
      ).toEqual({ 'jest-resolve': '28.1.3' });
    });

    it('should properly extract specifier', () => {
      expect(
        (
          parsedLockFile.dependencies['@ampproject/remapping'][
            '@ampproject/remapping@2.2.0'
          ].packageMeta[0] as any
        ).specifier
      ).toBeUndefined();
      expect(
        (
          parsedLockFile.dependencies['typescript']['typescript@4.8.4']
            .packageMeta[0] as any
        ).specifier
      ).toEqual('~4.8.2');
    });

    it('should properly extract dev dependency', () => {
      expect(
        (
          parsedLockFile.dependencies['@ampproject/remapping'][
            '@ampproject/remapping@2.2.0'
          ].packageMeta[0] as any
        ).isDevDependency
      ).toEqual(false);
      expect(
        (
          parsedLockFile.dependencies['typescript']['typescript@4.8.4']
            .packageMeta[0] as any
        ).isDevDependency
      ).toEqual(true);
    });

    it('should match the original file on stringification', () => {
      expect(stringifyPnpmLockFile(parsedLockFile)).toEqual(lockFile);
    });

    it('should prune the lock file', () => {
      expect(
        Object.keys(
          prunePnpmLockFile(parsedLockFile, TypeScriptOnlyPackage).dependencies
        ).length
      ).toEqual(1);
      expect(
        Object.keys(
          prunePnpmLockFile(parsedLockFile, YargsAndDevkitPackage).dependencies
        ).length
      ).toEqual(136);
    });

    it('should correctly prune lockfile with single package', () => {
      expect(
        stringifyPnpmLockFile(
          prunePnpmLockFile(parsedLockFile, TypeScriptOnlyPackage)
        )
      ).toEqual(lockFileJustTypescript);
    });

    it('should correctly prune lockfile with multiple packages', () => {
      expect(
        stringifyPnpmLockFile(
          prunePnpmLockFile(parsedLockFile, YargsAndDevkitPackage)
        )
      ).toEqual(lockFileYargsAndDevkit);
    });

    it('should correctly prune lockfile with package that has optional dependencies', () => {
      expect(
        stringifyPnpmLockFile(
          prunePnpmLockFile(parsePnpmLockFile(ssh2LockFile), Ssh2Package)
        )
      ).toEqual(ssh2LockFile);
    });

    it('should correctly prune lockfile with packages in multiple versions', () => {
      expect(
        stringifyPnpmLockFile(
          prunePnpmLockFile(
            parsePnpmLockFile(rxjsTslibLockFile),
            RxjsTslibPackage
          )
        )
      ).toEqual(rxjsTslibLockFile);
    });
  });

  it('should parse lockfile with time-based resolution and workspaces', () => {
    const parsedLockFile = parsePnpmLockFile(pnpmLockFileWithWorkspacesAndTime);
    expect(parsedLockFile.lockFileMetadata.time).toBeDefined();

    expect(stringifyPnpmLockFile(parsedLockFile)).toEqual(
      pnpmLockFileWithWorkspacesAndTime
    );
  });

  describe('lock file with inline specifiers', () => {
    const parsedLockFile = parsePnpmLockFile(lockFileWithInlineSpecifiers);

    it('should parse lockfile (IS)', () => {
      expect(parsedLockFile.lockFileMetadata).toEqual({
        lockfileVersion: '5.4-inlineSpecifiers',
      });
      expect(Object.keys(parsedLockFile.dependencies).length).toEqual(339);
      expect(
        parsedLockFile.dependencies['@ampproject/remapping']
      ).toMatchSnapshot();
      expect(parsedLockFile.dependencies['typescript']).toMatchSnapshot();
    });

    it('should map various versions of packages (IS)', () => {
      expect(
        Object.keys(parsedLockFile.dependencies['@jridgewell/gen-mapping'])
          .length
      ).toEqual(2);
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.1.1'
        ]
      ).toBeDefined();
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping'][
          '@jridgewell/gen-mapping@0.3.2'
        ]
      ).toBeDefined();
    });

    it('should map various instances of the same version (IS)', () => {
      const jestResolveDependency =
        parsedLockFile.dependencies['jest-pnp-resolver'][
          'jest-pnp-resolver@1.2.3'
        ];

      expect(jestResolveDependency.packageMeta.length).toEqual(2);
      expect((jestResolveDependency.packageMeta[0] as any).key).toEqual(
        '/jest-pnp-resolver/1.2.3_jest-resolve@28.1.1'
      );
      expect((jestResolveDependency.packageMeta[1] as any).key).toEqual(
        '/jest-pnp-resolver/1.2.3_jest-resolve@28.1.3'
      );

      expect(
        (jestResolveDependency.packageMeta[0] as any).dependencyDetails
          .dependencies
      ).toEqual({ 'jest-resolve': '28.1.1' });
      expect(
        (jestResolveDependency.packageMeta[1] as any).dependencyDetails
          .dependencies
      ).toEqual({ 'jest-resolve': '28.1.3' });
    });

    it('should properly extract specifier (IS)', () => {
      expect(
        (
          parsedLockFile.dependencies['@ampproject/remapping'][
            '@ampproject/remapping@2.2.0'
          ].packageMeta[0] as any
        ).specifier
      ).toBeUndefined();
      expect(
        (
          parsedLockFile.dependencies['typescript']['typescript@4.8.4']
            .packageMeta[0] as any
        ).specifier
      ).toEqual('~4.8.2');
    });

    it('should properly extract dev dependency (IS)', () => {
      expect(
        (
          parsedLockFile.dependencies['@ampproject/remapping'][
            '@ampproject/remapping@2.2.0'
          ].packageMeta[0] as any
        ).isDevDependency
      ).toEqual(false);
      expect(
        (
          parsedLockFile.dependencies['typescript']['typescript@4.8.4']
            .packageMeta[0] as any
        ).isDevDependency
      ).toEqual(true);
    });

    it('should match the original file on stringification (IS)', () => {
      expect(stringifyPnpmLockFile(parsedLockFile)).toEqual(
        lockFileWithInlineSpecifiers
      );
    });
  });

  it('should parse lockfile with inline specifiers and workspaces', () => {
    const parsedLockFile = parsePnpmLockFile(
      pnpmLockFileWithInlineSpecifiersAndWorkspaces
    );
    expect(stringifyPnpmLockFile(parsedLockFile)).toEqual(
      pnpmLockFileWithInlineSpecifiersAndWorkspaces
    );
  });
});
