import {
  parseYarnLockFile,
  pruneYarnLockFile,
  stringifyYarnLockFile,
} from './yarn';
import {
  berryLockFile,
  berryLockFileDevkitAndYargs,
  berrySsh2LockFile,
  lockFile,
  lockFileDevkitAndYargs,
  lockFileJustTypescript,
  ssh2LockFile,
} from './__fixtures__/yarn.lock';

const TypeScriptOnlyPackage = {
  name: 'test',
  version: '1.0.0',
  dependencies: { typescript: '4.8.4' },
};
const YargsAndDevkitPackage = {
  name: 'test',
  version: '0.0.0',
  dependencies: { '@nrwl/devkit': '15.0.13', yargs: '17.6.2' },
};
const YargsDevkitTypescriptPackage = {
  name: 'test',
  version: '0.0.0',
  dependencies: {
    '@nrwl/devkit': '15.0.13',
    typescript: '4.8.4',
    yargs: '17.6.2',
  },
};
const Ssh2Package = {
  name: 'test',
  version: '0.0.0',
  dependencies: {
    ssh2: '1.11.0',
  },
};

describe('yarn LockFile utility', () => {
  describe('classic', () => {
    const parsedLockFile = parseYarnLockFile(lockFile);

    it('should parse lockfile correctly', () => {
      expect(parsedLockFile.lockFileMetadata).toBeUndefined();
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
      const babelCoreDependency =
        parsedLockFile.dependencies['@babel/core']['@babel/core@7.19.1'];
      expect(babelCoreDependency.packageMeta.length).toEqual(2);
      expect(babelCoreDependency.packageMeta).toEqual([
        '@babel/core@^7.11.6',
        '@babel/core@^7.12.3',
      ]);
    });

    it('should match the original file on stringification', () => {
      expect(stringifyYarnLockFile(parsedLockFile)).toEqual(lockFile);
    });

    it('should prune the lock file', () => {
      expect(
        Object.keys(
          pruneYarnLockFile(parsedLockFile, TypeScriptOnlyPackage).dependencies
        ).length
      ).toEqual(1);
      expect(
        Object.keys(
          pruneYarnLockFile(parsedLockFile, YargsAndDevkitPackage).dependencies
        ).length
      ).toEqual(36);
    });

    it('should correctly prune lockfile with single package', () => {
      expect(
        stringifyYarnLockFile(
          pruneYarnLockFile(parsedLockFile, TypeScriptOnlyPackage)
        )
      ).toEqual(lockFileJustTypescript);
    });

    it('should correctly prune lockfile with multiple packages', () => {
      expect(
        stringifyYarnLockFile(
          pruneYarnLockFile(parsedLockFile, YargsAndDevkitPackage)
        )
      ).toEqual(lockFileDevkitAndYargs);
    });

    it('should correctly prune lockfile with package that has optional dependencies', () => {
      expect(
        stringifyYarnLockFile(
          pruneYarnLockFile(parseYarnLockFile(ssh2LockFile), Ssh2Package)
        )
      ).toEqual(ssh2LockFile);
    });
  });

  describe('berry', () => {
    const parsedLockFile = parseYarnLockFile(berryLockFile);

    it('should parse lockfile correctly', () => {
      expect(parsedLockFile.lockFileMetadata).toEqual({
        __metadata: { cacheKey: '8', version: '6' },
        workspacePackages: {
          'test@workspace:.': {
            dependencies: {
              '@nrwl/cli': '14.7.5',
              '@nrwl/workspace': '14.7.5',
              nx: '14.7.5',
              prettier: '^2.6.2',
              typescript: '~4.8.2',
            },
            languageName: 'unknown',
            linkType: 'soft',
            resolution: 'test@workspace:.',
            version: '0.0.0-use.local',
          },
        },
      });
      expect(Object.keys(parsedLockFile.dependencies).length).toEqual(386);
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
          '@jridgewell/gen-mapping@0.3.2'
        ]
      ).toBeDefined();
    });

    it('should map various instances of the same version', () => {
      const babelCoreDependency =
        parsedLockFile.dependencies['@babel/core']['@babel/core@7.19.1'];
      expect(babelCoreDependency.packageMeta.length).toEqual(2);
      expect(babelCoreDependency.packageMeta).toEqual([
        '@babel/core@npm:^7.11.6',
        '@babel/core@npm:^7.12.3',
      ]);
    });

    it('should match the original file on stringification', () => {
      const result = stringifyYarnLockFile(parsedLockFile);
      expect(result).toMatch(
        /This file was generated by Nx. Do not edit this file directly/
      );
      expect(removeComment(result)).toEqual(removeComment(berryLockFile));
    });

    it('should prune the lock file', () => {
      expect(
        Object.keys(
          pruneYarnLockFile(parsedLockFile, YargsDevkitTypescriptPackage)
            .dependencies
        ).length
      ).toEqual(37);
    });

    it('should correctly prune lockfile with multiple packages', () => {
      const result = stringifyYarnLockFile(
        pruneYarnLockFile(parsedLockFile, YargsDevkitTypescriptPackage)
      );
      expect(removeComment(result)).toEqual(
        removeComment(berryLockFileDevkitAndYargs)
      );
    });

    it('should correctly prune lockfile with multiple packages and custom name', () => {
      const result = pruneYarnLockFile(parsedLockFile, {
        ...YargsDevkitTypescriptPackage,
        name: 'custom-name',
      });
      expect(result.lockFileMetadata.workspacePackages).toMatchInlineSnapshot(`
        Object {
          "custom-name@workspace:^": Object {
            "dependencies": Object {
              "@nrwl/devkit": "14.7.5",
              "typescript": "~4.8.2",
              "yargs": "^17.4.0",
            },
            "languageName": "unknown",
            "linkType": "soft",
            "resolution": "custom-name@workspace:^",
            "version": "0.0.0-use.local",
          },
        }
      `);
    });

    it('should correctly prune lockfile with package that has optional dependencies', () => {
      expect(
        removeComment(
          stringifyYarnLockFile(
            pruneYarnLockFile(parseYarnLockFile(berrySsh2LockFile), Ssh2Package)
          )
        )
      ).toEqual(removeComment(berrySsh2LockFile));
    });
  });
});

// we don't care about comment message
const removeComment = (value) => value.split(/\n/).slice(2).join('\n');
