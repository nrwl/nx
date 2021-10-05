import { newProject, renameFile, runCLI, uniq } from '@nrwl/e2e/utils';

describe('nx workspace-lint', () => {
  it('should identify issues with the workspace', () => {
    const proj = newProject();

    const appBefore = uniq('before');
    const appAfter = uniq('after');

    runCLI(`generate @nrwl/angular:app ${appBefore}`);
    renameFile(`apps/${appBefore}`, `apps/${appAfter}`);

    const stdout = runCLI('workspace-lint', { silenceError: true });
    expect(stdout).toContain(
      `- Cannot find project '${appBefore}' in 'apps/${appBefore}'`
    );
    expect(stdout).toContain(
      'The following file(s) do not belong to any projects:'
    );
    expect(stdout).toContain(`- apps/${appAfter}/jest.config.js`);
    expect(stdout).toContain(`- apps/${appAfter}/src/app/app.component.css`);
    expect(stdout).toContain(`- apps/${appAfter}/src/app/app.component.html`);
    expect(stdout).toContain(
      `- apps/${appAfter}/src/app/app.component.spec.ts`
    );
  });
});
