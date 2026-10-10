import {
  cleanupProject,
  e2eCwd,
  runCommand,
  runCLI,
  readJson,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e-utils';

describe('create-nx-workspace --template', () => {
  afterEach(() => cleanupProject());

  const templates = ['nrwl/react-template'] as const;

  describe.each(['npm', 'pnpm'] as const)('with %s', (packageManager) => {
    it.each(templates)(
      'should clone %s and run lint,test,build',
      (template) => {
        const wsName = uniq('template');
        const packageManagerVersion = runCommand(
          `${packageManager} --version`,
          {
            cwd: e2eCwd,
            failOnError: true,
          }
        ).trim();

        runCreateWorkspace(wsName, {
          template,
          packageManager,
        });

        const packageJson = readJson('package.json');
        expect(packageJson.packageManager).toBe(
          `${packageManager}@${packageManagerVersion}`
        );

        expect(() => runCLI('run-many -t lint,test,build')).not.toThrow();

        const nxJson = readJson(`nx.json`);
        expect(nxJson.nxCloudId).toBeUndefined();
      },
      600_000
    );
  });
});
