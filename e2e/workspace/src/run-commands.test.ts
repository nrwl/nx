import {
  ensureProject,
  forEachCli,
  readJson,
  runCLI,
  uniq,
  updateFile,
  workspaceConfigName,
} from '@nrwl/e2e/utils';

forEachCli(() => {
  describe('Run Commands', () => {
    it('should not override environment variables already set when setting a custom env file path', async (done) => {
      ensureProject();
      const nodeapp = uniq('nodeapp');
      updateFile(
        `.env`,
        'SHARED_VAR=shared-root-value\nROOT_ONLY=root-only-value'
      );
      runCLI(`generate @nrwl/express:app ${nodeapp}`);
      updateFile(
        `apps/${nodeapp}/.custom.env`,
        'SHARED_VAR=shared-nested-value\nNESTED_ONLY=nested-only-value'
      );
      const config = readJson(workspaceConfigName());
      config.projects[nodeapp].architect.echoEnvVariables = {
        builder: '@nrwl/workspace:run-commands',
        options: {
          commands: [
            {
              command: `echo "$SHARED_VAR $ROOT_ONLY $NESTED_ONLY"`,
            },
          ],
          envFile: `apps/${nodeapp}/.custom.env`,
        },
      };
      updateFile(workspaceConfigName(), JSON.stringify(config));
      const result = runCLI('echoEnvVariables');
      expect(result).toContain('shared-root-value');
      expect(result).not.toContain('shared-nested-value');
      expect(result).toContain('root-only-value');
      expect(result).toContain('nested-only-value');
      done();
    }, 120000);
  });
});
