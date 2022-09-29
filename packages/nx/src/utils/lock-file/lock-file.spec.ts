import { mapLockFileDataToExternalNodes } from './lock-file';
import { LockFileData } from './lock-file-type';
import { parseNpmLockFile } from './npm';
import { parsePnpmLockFile } from './pnpm';
import { parseYarnLockFile } from './yarn';
import { lockFileYargsOnly } from './__fixtures__/npm.lock';
import { lockFileYargsOnly as pnpmLockFileYargsOnly } from './__fixtures__/pnpm.lock';
import { lockFileDevkitAndYargs } from './__fixtures__/yarn.lock';

describe('lock-file', () => {
  describe('mapLockFileDataToExternalNodes', () => {
    it('should map yarn lock file data to external nodes', () => {
      const lockFileData = parseYarnLockFile(lockFileDevkitAndYargs);

      const mappedExernalNodes = mapLockFileDataToExternalNodes(lockFileData);

      expect(mappedExernalNodes['npm:yargs']).toMatchSnapshot();
    });

    it('should map npm lock file data to external nodes', () => {
      const lockFileData = parseNpmLockFile(lockFileYargsOnly);

      const mappedExernalNodes = mapLockFileDataToExternalNodes(lockFileData);

      expect(mappedExernalNodes['npm:yargs']).toMatchSnapshot();
    });

    it('should map pnpm lock file data to external nodes', () => {
      const lockFileData = parsePnpmLockFile(pnpmLockFileYargsOnly);

      const mappedExernalNodes = mapLockFileDataToExternalNodes(lockFileData);

      console.log(JSON.stringify(lockFileData.dependencies['yargs'], null, 2));

      console.log(JSON.stringify(mappedExernalNodes['npm:yargs'], null, 2));

      expect(mappedExernalNodes['npm:yargs']).toMatchSnapshot();
    });
  });
});
