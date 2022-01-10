import {
  killPorts,
  newProject,
  promisifiedTreeKill,
  runCLI,
  runCommandUntil,
  uniq,
  updateProjectConfig,
} from '@nrwl/e2e/utils';

describe('file-server', () => {
  // todo(coly010): re-enable when http-server is fixed
  xit('should serve folder of files', async () => {
    newProject({ name: uniq('fileserver') });
    const appName = uniq('app');
    const port = 4301;

    runCLI(`generate @nrwl/web:app ${appName} --no-interactive`);
    updateProjectConfig(appName, (config) => {
      config.targets['serve'].executor = '@nrwl/web:file-server';
      return config;
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
