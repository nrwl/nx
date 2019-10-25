import { ensureProject, forEachCli, runCLI } from './utils';

forEachCli('nx', () => {
  describe('Help', () => {
    it('should show help', async () => {
      ensureProject();

      let mainHelp = runCLI(`--help`);
      expect(mainHelp).toContain('Run a target for a project');
      expect(mainHelp).toContain('Run task for affected projects');

      mainHelp = runCLI(`help`);
      expect(mainHelp).toContain('Run a target for a project');
      expect(mainHelp).toContain('Run task for affected projects');

      const genHelp = runCLI(`g @nrwl/web:app --help`);
      expect(genHelp).toContain(
        'The file extension to be used for style files. (default: css)'
      );

      const affectedHelp = runCLI(`affected --help`);
      expect(affectedHelp).toContain('Run task for affected projects');

      const version = runCLI(`--version`);
      expect(version).toContain('*'); // stub value
    }, 120000);
  });
});

forEachCli('angular', () => {
  describe('Help', () => {
    it('should show help', async () => {
      ensureProject();

      let mainHelp = runCLI(`--help`);
      expect(mainHelp).toContain('Run a target for a project');
      expect(mainHelp).toContain('Run task for affected projects');

      mainHelp = runCLI(`help`);
      expect(mainHelp).toContain('Run a target for a project');
      expect(mainHelp).toContain('Run task for affected projects');

      const genHelp = runCLI(`g @nrwl/web:app --help`);
      expect(genHelp).toContain(
        'The file extension to be used for style files.'
      );

      const affectedHelp = runCLI(`affected --help`);
      expect(affectedHelp).toContain('Run task for affected projects');

      const version = runCLI(`--version`);
      expect(version).toContain('*'); // stub value
    }, 120000);
  });
});
