import {
  checkFilesExist,
  cleanupProject,
  newProject,
  readJson,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

describe('Oxlint', () => {
  beforeAll(() => {
    newProject({ packages: ['@nx/oxlint', '@nx/js'] });
  });

  afterAll(() => cleanupProject());

  it('should set up the plugin and a root config', () => {
    runCLI('add @nx/oxlint');

    checkFilesExist('.oxlintrc.json');

    const nxJson = readJson('nx.json');
    const plugin = nxJson.plugins.find(
      (p: string | { plugin: string }) =>
        p === '@nx/oxlint/plugin' ||
        (typeof p === 'object' && p.plugin === '@nx/oxlint/plugin')
    );
    expect(plugin).toBeDefined();
  });

  it('should infer a cached lint task for a project with lintable files', () => {
    const lib = uniq('oxlintlib');
    runCLI(`generate @nx/js:lib packages/${lib} --no-interactive`);

    const project = JSON.parse(runCLI(`show project ${lib} --json`));
    const targetName = project.targets['lint'] ? 'lint' : 'oxlint';

    expect(project.targets[targetName].command).toContain('oxlint');
    expect(project.targets[targetName].cache).toBe(true);
    expect(project.targets[targetName].inputs).toContainEqual({
      externalDependencies: ['oxlint'],
    });

    expect(runCLI(`run ${lib}:${targetName}`)).toContain(
      `Successfully ran target ${targetName}`
    );
  });

  it('should fail the task when a rule is violated', () => {
    const lib = uniq('oxlintfaillib');
    runCLI(`generate @nx/js:lib packages/${lib} --no-interactive`);

    updateFile(
      '.oxlintrc.json',
      JSON.stringify({ rules: { 'no-debugger': 'error' } })
    );
    updateFile(
      `packages/${lib}/src/index.ts`,
      `export function boom() {\n  debugger;\n}\n`
    );

    const project = JSON.parse(runCLI(`show project ${lib} --json`));
    const targetName = project.targets['lint'] ? 'lint' : 'oxlint';

    expect(() => runCLI(`run ${lib}:${targetName}`)).toThrow();
  });
});
