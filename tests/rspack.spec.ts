import {
  checkFilesExist,
  ensureNxProject,
  listFiles,
  runNxCommandAsync,
  uniq,
  updateFile,
} from '@nrwl/nx-plugin/testing';

describe('rspack e2e', () => {
  // Setting up individual workspaces per
  // test can cause e2e runs to take a long time.
  // For this reason, we recommend each suite only
  // consumes 1 workspace. The tests should each operate
  // on a unique project in the workspace, such that they
  // are not dependant on one another.
  beforeAll(() => {
    ensureNxProject('@nrwl/rspack', 'dist/packages/rspack');
  });

  afterAll(() => {
    // `nx reset` kills the daemon, and performs
    // some work which can help clean up e2e leftovers
    runNxCommandAsync('reset');
  });

  it('should create rspack root project and additional apps', async () => {
    const project = uniq('myapp');
    await runNxCommandAsync(
      `generate @nrwl/rspack:preset ${project} --unitTestRunner=jest --e2eTestRunner=cypress`
    );
    let result = await runNxCommandAsync(`build ${project}`, {
      env: { NODE_ENV: 'production' },
    });
    expect(result.stdout).toContain('Successfully ran target build');
    // Make sure expected files are present.
    expect(listFiles(`dist/${project}`)).toHaveLength(5);

    result = await runNxCommandAsync(`lint ${project}`);
    expect(result.stdout).toContain('Successfully ran target lint');

    result = await runNxCommandAsync(`test ${project}`);
    expect(result.stdout).toContain('Successfully ran target test');

    result = await runNxCommandAsync(`e2e e2e`);
    expect(result.stdout).toContain('Successfully ran target e2e');

    // Update app and make sure previous dist files are not present.
    updateFile(`src/app/app.tsx`, (content) => {
      return `${content}\nconsole.log('hello');
    `;
    });
    result = await runNxCommandAsync(`build ${project}`, {
      env: { NODE_ENV: 'production' },
    });
    expect(result.stdout).toContain('Successfully ran target build');
    expect(listFiles(`dist/${project}`)).toHaveLength(5); // same length as before

    // Generate a new app and check that the files are correct
    const app2 = uniq('app2');
    await runNxCommandAsync(
      `generate @nrwl/rspack:app ${app2} --unitTestRunner=jest --e2eTestRunner=cypress --style=css`
    );
    checkFilesExist(`${app2}/project.json`, `${app2}-e2e/project.json`);
    result = await runNxCommandAsync(`build ${app2}`, {
      env: { NODE_ENV: 'production' },
    });
    expect(result.stdout).toContain('Successfully ran target build');
    // Make sure expected files are present.
    expect(listFiles(`dist/${app2}`)).toHaveLength(5);

    result = await runNxCommandAsync(`lint ${app2}`);
    expect(result.stdout).toContain('Successfully ran target lint');

    result = await runNxCommandAsync(`test ${app2}`);
    expect(result.stdout).toContain('Successfully ran target test');

    result = await runNxCommandAsync(`e2e ${app2}-e2e`);
    expect(result.stdout).toContain('Successfully ran target e2e');
  }, 120_000);
});
