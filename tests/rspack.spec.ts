import {
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

  it('should create rspack project', async () => {
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
  }, 120_000);
});
