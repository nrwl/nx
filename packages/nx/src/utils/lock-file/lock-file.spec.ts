import { mapLockFileDataToPartialGraph } from './lock-file';
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

      const partialGraph = mapLockFileDataToPartialGraph(lockFileData);

      expect(partialGraph.externalNodes['npm:yargs']).toMatchSnapshot();
      expect(partialGraph.dependencies['npm:yargs']).toMatchSnapshot();
    });

    it('should map successfully complex yarn lock file', () => {
      const lockFileData = parseYarnLockFile(yarnLockFile);

      const partialGraph = mapLockFileDataToPartialGraph(lockFileData);

      expect(partialGraph.externalNodes['npm:nx']).toMatchSnapshot();
      expect(partialGraph.dependencies['npm:nx']).toMatchSnapshot();
    });

    it('should map npm lock file data to external nodes', () => {
      const lockFileData = parseNpmLockFile(npmLockFileYargsOnly);

      const partialGraph = mapLockFileDataToPartialGraph(lockFileData);

      expect(partialGraph.externalNodes['npm:yargs']).toMatchSnapshot();
      expect(partialGraph.dependencies['npm:yargs']).toMatchSnapshot();
    });

    it('should map successfully complex npm lock file', () => {
      const lockFileData = parseNpmLockFile(npmLockFile);

      const partialGraph = mapLockFileDataToPartialGraph(lockFileData);

      expect(partialGraph.externalNodes['npm:nx']).toMatchSnapshot();
      expect(partialGraph.dependencies['npm:nx']).toMatchSnapshot();
    });

    it('should map pnpm lock file data to external nodes', () => {
      const lockFileData = parsePnpmLockFile(pnpmLockFileYargsOnly);

      const partialGraph = mapLockFileDataToPartialGraph(lockFileData);

      expect(partialGraph.externalNodes['npm:yargs']).toMatchSnapshot();
      expect(partialGraph.dependencies['npm:yargs']).toMatchSnapshot();
    });

    it('should map successfully complex pnpm lock file', () => {
      const lockFileData = parsePnpmLockFile(pnpmLockFile);

      const partialGraph = mapLockFileDataToPartialGraph(lockFileData);

      expect(partialGraph.externalNodes['npm:nx']).toMatchSnapshot();
      expect(partialGraph.dependencies['npm:nx']).toMatchSnapshot();
      expect(
        partialGraph.externalNodes['npm:@phenomnomnominal/tsquery']
      ).toMatchSnapshot();
      expect(
        partialGraph.dependencies['npm:@phenomnomnominal/tsquery']
      ).toMatchSnapshot();
    });
  });
});
