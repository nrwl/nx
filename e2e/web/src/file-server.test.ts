import {
  newProject,
  readJson,
  runCLI,
  runCommandUntil,
  uniq,
  updateFile,
  workspaceConfigName,
} from '@nrwl/e2e/utils';
import { serializeJson } from '@nrwl/workspace';

describe('file-server', () => {
  beforeEach(() => newProject());

  it('should serve folder of files', async () => {
    const appName = uniq('app');

    runCLI(`generate @nrwl/web:app ${appName} --no-interactive`);
    const workspaceJson = readJson(workspaceConfigName());
    workspaceJson.projects[appName].targets['serve'].executor =
      '@nrwl/web:file-server';
    updateFile(workspaceConfigName(), serializeJson(workspaceJson));

    await runCommandUntil(`serve ${appName}`, (output) => {
      return (
        output.indexOf('Built at') > -1 && output.indexOf('Available on') > -1
      );
    });
  }, 300000);
});
