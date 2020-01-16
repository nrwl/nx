import {
  ensureProject,
  readJson,
  runCommand,
  uniq,
  updateFile,
  runCLI,
  forEachCli,
  workspaceConfigName
} from './utils';
import { NxJson } from '@nrwl/workspace/src/core/shared-interfaces';

forEachCli(() => {
  describe('Affected (with Git)', () => {
    let myapp = uniq('myapp');
    let myapp2 = uniq('myapp');
    let mylib = uniq('mylib');
    it('should not affect other projects by generating a new project', () => {
      ensureProject();

      const nxJson: NxJson = readJson('nx.json');

      delete nxJson.implicitDependencies;

      updateFile('nx.json', JSON.stringify(nxJson));
      runCommand(`git init`);
      runCommand(`git config user.email "test@test.com"`);
      runCommand(`git config user.name "Test"`);
      runCommand(
        `git add . && git commit -am "initial commit" && git checkout -b master`
      );
      runCLI(`generate @nrwl/angular:app ${myapp}`);
      expect(runCommand('yarn affected:apps')).toContain(myapp);
      runCommand(`git add . && git commit -am "add ${myapp}"`);

      runCLI(`generate @nrwl/angular:app ${myapp2}`);
      expect(runCommand('yarn affected:apps')).not.toContain(myapp);
      expect(runCommand('yarn affected:apps')).toContain(myapp2);
      runCommand(`git add . && git commit -am "add ${myapp2}"`);

      runCLI(`generate @nrwl/angular:lib ${mylib}`);
      expect(runCommand('yarn affected:apps')).not.toContain(myapp);
      expect(runCommand('yarn affected:apps')).not.toContain(myapp2);
      expect(runCommand('yarn affected:libs')).toContain(mylib);
      runCommand(`git add . && git commit -am "add ${mylib}"`);
    }, 1000000);

    it('should detect changes to projects based on the nx.json', () => {
      const nxJson: NxJson = readJson('nx.json');

      nxJson.projects[myapp].tags = ['tag'];
      updateFile('nx.json', JSON.stringify(nxJson));
      expect(runCommand('yarn affected:apps')).toContain(myapp);
      expect(runCommand('yarn affected:apps')).not.toContain(myapp2);
      expect(runCommand('yarn affected:libs')).not.toContain(mylib);
      runCommand(`git add . && git commit -am "add tag to ${myapp}"`);
    });

    it('should detect changes to projects based on the workspace.json', () => {
      const workspaceJson = readJson(workspaceConfigName());

      workspaceJson.projects[myapp].prefix = 'my-app';
      updateFile(workspaceConfigName(), JSON.stringify(workspaceJson));
      expect(runCommand('yarn affected:apps')).toContain(myapp);
      expect(runCommand('yarn affected:apps')).not.toContain(myapp2);
      expect(runCommand('yarn affected:libs')).not.toContain(mylib);
      runCommand(`git add . && git commit -am "change prefix for ${myapp}"`);
    });

    it('should affect all projects by removing projects', () => {
      const workspaceJson = readJson(workspaceConfigName());
      delete workspaceJson.projects[mylib];
      updateFile(workspaceConfigName(), JSON.stringify(workspaceJson));

      const nxJson = readJson('nx.json');
      delete nxJson.projects[mylib];
      updateFile('nx.json', JSON.stringify(nxJson));

      expect(runCommand('yarn affected:apps')).toContain(myapp);
      expect(runCommand('yarn affected:apps')).toContain(myapp2);
      expect(runCommand('yarn affected:libs')).not.toContain(mylib);
      runCommand(`git add . && git commit -am "remove ${mylib}"`);
    });
  });
});
