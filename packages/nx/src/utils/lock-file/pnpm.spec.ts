import { parsePnpmLockFile, stringifyPnpmLockFile } from './pnpm';
import {
  lockFile,
  lockFileWithInlineSpecifiers,
} from './__fixtures__/pnpm.lock';

describe('pnpm LockFile utility', () => {
  describe('standard lock file', () => {
    const parsedLockFile = parsePnpmLockFile(lockFile);

    it('should parse lockfile correctly', () => {
      expect(parsedLockFile.lockFileMetadata).toEqual({ lockfileVersion: 5.4 });
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
      const jestResolveDependency =
        parsedLockFile.dependencies['jest-pnp-resolver'][
          'jest-pnp-resolver@1.2.2'
        ];

      expect(jestResolveDependency.packageMeta.length).toEqual(2);
      expect((jestResolveDependency.packageMeta[0] as any).key).toEqual(
        '/jest-pnp-resolver/1.2.2_jest-resolve@28.1.1'
      );
      expect((jestResolveDependency.packageMeta[1] as any).key).toEqual(
        '/jest-pnp-resolver/1.2.2_jest-resolve@28.1.3'
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
          parsedLockFile.dependencies['typescript']['typescript@4.8.3']
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
          parsedLockFile.dependencies['typescript']['typescript@4.8.3']
            .packageMeta[0] as any
        ).isDevDependency
      ).toEqual(true);
    });

    it('should match the original file on stringification', () => {
      expect(stringifyPnpmLockFile(parsedLockFile)).toEqual(lockFile);
    });
  });

  describe('lock file with inline specifiers', () => {
    const parsedLockFile = parsePnpmLockFile(lockFileWithInlineSpecifiers);

    it('should parse lockfile (IS)', () => {
      expect(parsedLockFile.lockFileMetadata).toEqual({
        lockfileVersion: '5.4-inlineSpecifiers',
      });
      expect(Object.keys(parsedLockFile.dependencies).length).toEqual(324);
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
          'jest-pnp-resolver@1.2.2'
        ];

      expect(jestResolveDependency.packageMeta.length).toEqual(2);
      expect((jestResolveDependency.packageMeta[0] as any).key).toEqual(
        '/jest-pnp-resolver/1.2.2_jest-resolve@28.1.1'
      );
      expect((jestResolveDependency.packageMeta[1] as any).key).toEqual(
        '/jest-pnp-resolver/1.2.2_jest-resolve@28.1.3'
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
          parsedLockFile.dependencies['typescript']['typescript@4.8.3']
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
          parsedLockFile.dependencies['typescript']['typescript@4.8.3']
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
});
