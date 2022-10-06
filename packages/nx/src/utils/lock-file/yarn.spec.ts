import {
  parseYarnLockFile,
  pruneYarnLockFile,
  stringifyYarnLockFile,
} from './yarn';
import {
  lockFile,
  berryLockFile,
  lockFileJustTypescript,
  lockFileDevkitAndYargs,
  berryLockFileDevkitAndYargs,
} from './__fixtures__/yarn.lock';

describe('yarn LockFile utility', () => {
  describe('classic', () => {
    console.time('before');
    const parsedLockFile = parseYarnLockFile(lockFile);
    console.timeEnd('before');

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

    it('shold prune the lock file', () => {
      expect(
        Object.keys(
          pruneYarnLockFile(parsedLockFile, ['typescript']).dependencies
        ).length
      ).toEqual(1);
      expect(
        Object.keys(
          pruneYarnLockFile(parsedLockFile, ['yargs', '@nrwl/devkit'])
            .dependencies
        ).length
      ).toEqual(36);
    });

    it('shold correctly prune lockfile with single package', () => {
      expect(
        stringifyYarnLockFile(pruneYarnLockFile(parsedLockFile, ['typescript']))
      ).toEqual(lockFileJustTypescript);
    });

    it('shold correctly prune lockfile with multiple packages', () => {
      expect(
        stringifyYarnLockFile(
          pruneYarnLockFile(parsedLockFile, ['yargs', '@nrwl/devkit'])
        )
      ).toEqual(lockFileDevkitAndYargs);
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

    it('shold prune the lock file', () => {
      expect(
        Object.keys(
          pruneYarnLockFile(parsedLockFile, [
            'yargs',
            '@nrwl/devkit',
            'typescript',
          ]).dependencies
        ).length
      ).toEqual(37);
    });

    it('shold correctly prune lockfile with multiple packages', () => {
      const result = stringifyYarnLockFile(
        pruneYarnLockFile(parsedLockFile, [
          'yargs',
          '@nrwl/devkit',
          'typescript',
        ])
      );
      expect(removeComment(result)).toEqual(
        removeComment(berryLockFileDevkitAndYargs)
      );
    });
  });
});

// we don't care about comment message
const removeComment = (value) => value.split(/\n/).slice(2).join('\n');
