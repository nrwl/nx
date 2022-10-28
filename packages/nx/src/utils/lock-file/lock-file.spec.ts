import { mapLockFileDataToPartialGraph } from './lock-file';
import { parseNpmLockFile } from './npm';
import { parsePnpmLockFile } from './pnpm';
import { parseYarnLockFile } from './yarn';
import {
  lockFileV3YargsOnly as npmLockFileV3YargsOnly,
  lockFileV2YargsOnly as npmLockFileV2YargsOnly,
  lockFileV1YargsOnly as npmLockFileV1YargsOnly,
  lockFileV3 as npmLockFileV3,
  lockFileV2 as npmLockFileV2,
  lockFileV1 as npmLockFileV1,
} from './__fixtures__/npm.lock';
import {
  lockFileYargsOnly as pnpmLockFileYargsOnly,
  lockFile as pnpmLockFile,
} from './__fixtures__/pnpm.lock';
import {
  lockFileDevkitAndYargs as yarnLockFileDevkitAndYargs,
  lockFile as yarnLockFile,
} from './__fixtures__/yarn.lock';

describe('lock-file', () => {
  describe('mapLockFileDataToExternalNodes', () => {
    describe('yarn', () => {
      it('should map lock file data to external nodes', () => {
        const lockFileData = parseYarnLockFile(yarnLockFileDevkitAndYargs);

        const partialGraph = mapLockFileDataToPartialGraph(lockFileData);

        expect(partialGraph.externalNodes['npm:yargs']).toMatchSnapshot();
        expect(partialGraph.dependencies['npm:yargs']).toMatchSnapshot();
      });

      it('should map successfully complex lock file', () => {
        const lockFileData = parseYarnLockFile(yarnLockFile);

        const partialGraph = mapLockFileDataToPartialGraph(lockFileData);

        expect(partialGraph.externalNodes['npm:nx']).toMatchSnapshot();
        expect(partialGraph.dependencies['npm:nx']).toMatchSnapshot();
      });
    });

    describe('npm', () => {
      it('should map lock file v3 data to external nodes', () => {
        const lockFileData = parseNpmLockFile(npmLockFileV3YargsOnly);

        const partialGraph = mapLockFileDataToPartialGraph(lockFileData);

        expect(partialGraph.externalNodes['npm:yargs']).toMatchSnapshot();
        expect(partialGraph.dependencies['npm:yargs']).toMatchSnapshot();
      });

      it('should map lock file v2 data to external nodes', () => {
        const lockFileData = parseNpmLockFile(npmLockFileV2YargsOnly);

        const partialGraph = mapLockFileDataToPartialGraph(lockFileData);

        expect(partialGraph.externalNodes['npm:yargs']).toMatchSnapshot();
        expect(partialGraph.dependencies['npm:yargs']).toMatchSnapshot();
      });

      it('should map lock file v1 data to external nodes', () => {
        const lockFileData = parseNpmLockFile(npmLockFileV1YargsOnly);

        const partialGraph = mapLockFileDataToPartialGraph(lockFileData);

        expect(partialGraph.externalNodes['npm:yargs']).toMatchSnapshot();
        expect(partialGraph.dependencies['npm:yargs']).toMatchSnapshot();
      });

      it('should map successfully complex lock file v3', () => {
        const lockFileData = parseNpmLockFile(npmLockFileV3);

        const partialGraph = mapLockFileDataToPartialGraph(lockFileData);

        expect(partialGraph.externalNodes['npm:nx']).toMatchSnapshot();
        expect(partialGraph.dependencies['npm:nx']).toMatchSnapshot();
      });

      it('should map successfully complex lock file v2', () => {
        const lockFileData = parseNpmLockFile(npmLockFileV2);

        const partialGraph = mapLockFileDataToPartialGraph(lockFileData);

        expect(partialGraph.externalNodes['npm:nx']).toMatchSnapshot();
        expect(partialGraph.dependencies['npm:nx']).toMatchSnapshot();
      });

      it('should map successfully complex npm lock file v1', () => {
        const lockFileData = parseNpmLockFile(npmLockFileV1);

        const partialGraph = mapLockFileDataToPartialGraph(lockFileData);

        expect(partialGraph.externalNodes['npm:nx']).toMatchSnapshot();
        expect(partialGraph.dependencies['npm:nx']).toMatchSnapshot();
      });
    });

    describe('pnpm', () => {
      it('should map lock file data to external nodes', () => {
        const lockFileData = parsePnpmLockFile(pnpmLockFileYargsOnly);

        const partialGraph = mapLockFileDataToPartialGraph(lockFileData);

        expect(partialGraph.externalNodes['npm:yargs']).toMatchSnapshot();
        expect(partialGraph.dependencies['npm:yargs']).toMatchSnapshot();
      });

      it('should map successfully complex lock file', () => {
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
});
