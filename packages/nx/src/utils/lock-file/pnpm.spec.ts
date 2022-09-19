import { parseLockFile, stringifyLockFile } from './pnpm';
import {
  lockFile,
  lockFileWithInlineSpecifiers,
} from './__fixtures__/pnpm.lock';

describe('pnpm LockFile utility', () => {
  describe('standard lock file', () => {
    const parsedLockFile = parseLockFile(lockFile);

    it('should parse lockfile correctly', () => {
      expect(parsedLockFile.lockFileMetadata).toEqual({ lockfileVersion: 5.4 });
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
        parsedLockFile.dependencies['jest-pnp-resolver@1.2.2'].packageMeta
          .length
      ).toEqual(2);
      expect(
        parsedLockFile.dependencies['jest-pnp-resolver@1.2.2'].packageMeta[0]
          .key
      ).toEqual('/jest-pnp-resolver/1.2.2_jest-resolve@28.1.1');
      expect(
        parsedLockFile.dependencies['jest-pnp-resolver@1.2.2'].packageMeta[1]
          .key
      ).toEqual('/jest-pnp-resolver/1.2.2_jest-resolve@28.1.3');

      expect(
        parsedLockFile.dependencies['jest-pnp-resolver@1.2.2'].packageMeta[0]
          .dependencyDetails.dependencies
      ).toEqual({ 'jest-resolve': '28.1.1' });
      expect(
        parsedLockFile.dependencies['jest-pnp-resolver@1.2.2'].packageMeta[1]
          .dependencyDetails.dependencies
      ).toEqual({ 'jest-resolve': '28.1.3' });
    });

    it('should properly extract specifier', () => {
      expect(
        parsedLockFile.dependencies['@ampproject/remapping@2.2.0']
          .packageMeta[0].specifier
      ).toBeUndefined();
      expect(
        parsedLockFile.dependencies['typescript@4.8.3'].packageMeta[0].specifier
      ).toEqual('~4.8.2');
    });

    it('should properly extract dev dependency', () => {
      expect(
        parsedLockFile.dependencies['@ampproject/remapping@2.2.0']
          .packageMeta[0].isDevDependency
      ).toEqual(false);
      expect(
        parsedLockFile.dependencies['typescript@4.8.3'].packageMeta[0]
          .isDevDependency
      ).toEqual(true);
    });

    it('should match the original file on stringification', () => {
      expect(stringifyLockFile(parsedLockFile)).toEqual(lockFile);
    });
  });

  describe('lock file with inline specifiers', () => {
    const parsedLockFile = parseLockFile(lockFileWithInlineSpecifiers);

    it('should parse lockfile (IS)', () => {
      expect(parsedLockFile.lockFileMetadata).toEqual({
        lockfileVersion: '5.4-inlineSpecifiers',
      });
      expect(Object.keys(parsedLockFile.dependencies).length).toEqual(349);
      expect(
        parsedLockFile.dependencies['@ampproject/remapping@2.2.0']
      ).toMatchSnapshot();
      expect(parsedLockFile.dependencies['typescript@4.8.3']).toMatchSnapshot();
    });

    it('should map various versions of packages (IS)', () => {
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping@0.1.1']
      ).toBeDefined();
      expect(
        parsedLockFile.dependencies['@jridgewell/gen-mapping@0.3.2']
      ).toBeDefined();
    });

    it('should map various instances of the same version (IS)', () => {
      expect(
        parsedLockFile.dependencies['jest-pnp-resolver@1.2.2'].packageMeta
          .length
      ).toEqual(2);
      expect(
        parsedLockFile.dependencies['jest-pnp-resolver@1.2.2'].packageMeta[0]
          .key
      ).toEqual('/jest-pnp-resolver/1.2.2_jest-resolve@28.1.1');
      expect(
        parsedLockFile.dependencies['jest-pnp-resolver@1.2.2'].packageMeta[1]
          .key
      ).toEqual('/jest-pnp-resolver/1.2.2_jest-resolve@28.1.3');

      expect(
        parsedLockFile.dependencies['jest-pnp-resolver@1.2.2'].packageMeta[0]
          .dependencyDetails.dependencies
      ).toEqual({ 'jest-resolve': '28.1.1' });
      expect(
        parsedLockFile.dependencies['jest-pnp-resolver@1.2.2'].packageMeta[1]
          .dependencyDetails.dependencies
      ).toEqual({ 'jest-resolve': '28.1.3' });
    });

    it('should properly extract specifier (IS)', () => {
      expect(
        parsedLockFile.dependencies['@ampproject/remapping@2.2.0']
          .packageMeta[0].specifier
      ).toBeUndefined();
      expect(
        parsedLockFile.dependencies['typescript@4.8.3'].packageMeta[0].specifier
      ).toEqual('~4.8.2');
    });

    it('should properly extract dev dependency (IS)', () => {
      expect(
        parsedLockFile.dependencies['@ampproject/remapping@2.2.0']
          .packageMeta[0].isDevDependency
      ).toEqual(false);
      expect(
        parsedLockFile.dependencies['typescript@4.8.3'].packageMeta[0]
          .isDevDependency
      ).toEqual(true);
    });

    it('should match the original file on stringification (IS)', () => {
      expect(stringifyLockFile(parsedLockFile)).toEqual(
        lockFileWithInlineSpecifiers
      );
    });
  });
});
