import {
  killPorts,
  newProject,
  promisifiedTreeKill,
  readJson,
  runCLI,
  runCommandUntil,
  uniq,
  updateFile,
  updateWorkspaceConfig,
  workspaceConfigName,
} from '@nrwl/e2e/utils';
import { serializeJson } from '@nrwl/workspace';

describe('file-server', () => {
  it('should serve folder of files', async () => {
    newProject({ name: uniq('fileserver') });
    const appName = uniq('app');
    const port = 4301;

    runCLI(`generate @nrwl/web:app ${appName} --no-interactive`);
    updateWorkspaceConfig((workspaceJson) => {
      workspaceJson.projects[appName].targets['serve'].executor =
        '@nrwl/web:file-server';
      return workspaceJson;
    });

    const p = await runCommandUntil(
      `serve ${appName} --port=${port}`,
      (output) => {
        return (
          output.indexOf('webpack compiled') > -1 &&
          output.indexOf(`localhost:${port}`) > -1
        );
      }
    );

    try {
      await promisifiedTreeKill(p.pid, 'SIGKILL');
      await killPorts(port);
    } catch (err) {
      expect(err).toBeFalsy();
    }
  }, 1000000);
});
