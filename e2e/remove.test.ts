import { NxJson } from '@nrwl/workspace';
import {
  exists,
  forEachCli,
  newProject,
  readFile,
  readJson,
  runCLI,
  tmpProjPath,
  uniq
} from './utils';

forEachCli(cli => {
  describe('Remove Project', () => {
    const workspace: string = cli === 'angular' ? 'angular' : 'workspace';

    /**
     * Tries creating then deleting a lib
     */
    it('should work', () => {
      const lib = uniq('mylib');

      newProject();

      runCLI(`generate @nrwl/workspace:lib ${lib}`);
      expect(exists(tmpProjPath(`libs/${lib}`))).toBeTruthy();

      const removeOutput = runCLI(
        `generate @nrwl/workspace:remove --project ${lib}`
      );

      expect(removeOutput).toContain(`DELETE libs/${lib}`);
      expect(exists(tmpProjPath(`libs/${lib}`))).toBeFalsy();

      expect(removeOutput).toContain(`UPDATE nx.json`);
      const nxJson = JSON.parse(readFile('nx.json')) as NxJson;
      expect(nxJson.projects[`${lib}`]).toBeUndefined();

      expect(removeOutput).toContain(`UPDATE ${workspace}.json`);
      const workspaceJson = readJson(`${workspace}.json`);
      expect(workspaceJson.projects[`${lib}`]).toBeUndefined();
    });
  });
});
