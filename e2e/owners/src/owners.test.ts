import {
  cleanupProject,
  createFile,
  newProject,
  readFile,
  readJson,
  runCLI,
  updateJson,
} from '@nx/e2e-utils';

describe('@nx/owners', () => {
  beforeAll(() => {
    newProject({ packages: ['@nx/owners'] });
  });

  afterAll(() => cleanupProject());

  it('should init', () => {
    runCLI('g @nx/owners:init');

    const nxJson = readJson('nx.json');
    expect(nxJson.plugins).toContain('@nx/owners');
    expect(nxJson.sync.globalGenerators).toContain(
      '@nx/owners:sync-codeowners-file'
    );
    expect(nxJson.owners).toEqual({ patterns: [] });
  });

  it('should generate scoped CODEOWNERS entries when both projects and files are specified', () => {
    for (const lib of ['ui-buttons', 'ui-forms']) {
      createFile(`libs/${lib}/src/index.ts`, 'export default {};');
      createFile(`libs/${lib}/project.json`, JSON.stringify({ name: lib }));
      createFile(`libs/${lib}/tsconfig.json`, '{}');
    }

    updateJson('nx.json', (json) => ({
      ...json,
      owners: {
        format: 'github',
        patterns: [
          { projects: ['ui-*'], owners: ['@team-a'] },
          {
            projects: ['ui-*'],
            files: ['project.json', 'tsconfig.json'],
            owners: ['@ops-team'],
          },
        ],
      },
    }));

    runCLI('g @nx/owners:sync-codeowners-file');

    const codeowners = readFile('.github/CODEOWNERS');
    expect(codeowners).toContain('/libs/ui-buttons/ @team-a');
    expect(codeowners).toContain('/libs/ui-buttons/project.json @ops-team');
    expect(codeowners).toContain('/libs/ui-buttons/tsconfig.json @ops-team');
    expect(codeowners).toContain('/libs/ui-forms/ @team-a');
    expect(codeowners).toContain('/libs/ui-forms/project.json @ops-team');
    expect(codeowners).toContain('/libs/ui-forms/tsconfig.json @ops-team');
  });
});
