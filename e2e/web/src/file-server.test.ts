import {
  killPorts,
  newProject,
  readJson,
  runCLI,
  runCommandUntil,
  uniq,
  updateFile,
  workspaceConfigName,
  promisifiedTreeKill,
} from '@nrwl/e2e/utils';
import { serializeJson } from '@nrwl/workspace';
import * as http from 'http';

describe('file-server', () => {
  it('should serve folder of files', async () => {
    newProject({ name: uniq('fileserver') });
    const appName = uniq('app');
    const port = 4301;

    runCLI(`generate @nrwl/web:app ${appName} --no-interactive`);
    const workspaceJson = readJson(workspaceConfigName());
    workspaceJson.projects[appName].targets['serve'].executor =
      '@nrwl/web:file-server';
    updateFile(workspaceConfigName(), serializeJson(workspaceJson));

    const p = await runCommandUntil(
      `serve ${appName} --port=${port}`,
      (output) => {
        return (
          output.indexOf('Built at') > -1 &&
          output.indexOf(`localhost:${port}`) > -1
        );
      }
    );

    const data = await getData(port);
    expect(data).toContain(`Welcome to ${appName}`);

    try {
      await promisifiedTreeKill(p.pid, 'SIGKILL');
      await killPorts(port);
      // expect(await killPorts(port)).toBeTruthy();
    } catch (err) {
      expect(err).toBeFalsy();
    }
  }, 300000);
});

function getData(port: number): Promise<any> {
  return new Promise((resolve) => {
    http.get(`http://localhost:${port}`, (res) => {
      expect(res.statusCode).toEqual(200);
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.once('end', () => {
        resolve(data);
      });
    });
  });
}
