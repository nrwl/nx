import { mapLockFileDataToExternalNodes } from './lock-file';
import { parseNpmLockFile } from './npm';
import { parsePnpmLockFile } from './pnpm';
import { parseYarnLockFile } from './yarn';
import {
  lockFileYargsOnly as npmLockFileYargsOnly,
  lockFile as npmLockFile,
} from './__fixtures__/npm.lock';
import {
  lockFileYargsOnly as pnpmLockFileYargsOnly,
  lockFile as pnpmLockFile,
} from './__fixtures__/pnpm.lock';
import {
  lockFileDevkitAndYargs,
  lockFile as yarnLockFile,
} from './__fixtures__/yarn.lock';

describe('lock-file', () => {
  describe('mapLockFileDataToExternalNodes', () => {
    it('should map yarn lock file data to external nodes', () => {
      const lockFileData = parseYarnLockFile(lockFileDevkitAndYargs);

      const mappedExernalNodes = mapLockFileDataToExternalNodes(lockFileData);

      expect(mappedExernalNodes['npm:yargs']).toMatchSnapshot();
    });

    it('should map successfully complex yarn lock file', () => {
      const lockFileData = parseYarnLockFile(yarnLockFile);

      const mappedExernalNodes = mapLockFileDataToExternalNodes(lockFileData);

      expect(mappedExernalNodes['npm:nx']).toMatchSnapshot();
    });

    it('should map npm lock file data to external nodes', () => {
      const lockFileData = parseNpmLockFile(npmLockFileYargsOnly);

      const mappedExernalNodes = mapLockFileDataToExternalNodes(lockFileData);

      expect(mappedExernalNodes['npm:yargs']).toMatchSnapshot();
    });

    it('should map successfully complex npm lock file', () => {
      const lockFileData = parseNpmLockFile(npmLockFile);

      const mappedExernalNodes = mapLockFileDataToExternalNodes(lockFileData);

      expect(mappedExernalNodes['npm:nx']).toMatchSnapshot();
    });

    it('should map pnpm lock file data to external nodes', () => {
      const lockFileData = parsePnpmLockFile(pnpmLockFileYargsOnly);

      const mappedExernalNodes = mapLockFileDataToExternalNodes(lockFileData);

      expect(mappedExernalNodes['npm:yargs']).toMatchSnapshot();
    });

    it('should map successfully complex pnpm lock file', () => {
      const lockFileData = parsePnpmLockFile(pnpmLockFile);

      const mappedExernalNodes = mapLockFileDataToExternalNodes(lockFileData);

      expect(mappedExernalNodes['npm:nx']).toMatchSnapshot();
      expect(
        mappedExernalNodes['npm:@phenomnomnominal/tsquery']
      ).toMatchSnapshot();
    });
  });
});
