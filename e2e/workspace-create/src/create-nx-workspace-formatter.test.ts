import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  getSelectedPackageManager,
  readFile,
  readJson,
  runCLI,
  runCreateWorkspace,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

describe('create-nx-workspace --formatter', () => {
  const packageManager = getSelectedPackageManager() || 'pnpm';

  afterEach(() => cleanupProject());

  it('should set up oxfmt and use it for format:check and format:write', () => {
    const wsName = uniq('oxfmt');
    runCreateWorkspace(wsName, {
      preset: 'ts',
      packageManager,
      formatter: 'oxfmt',
    });

    checkFilesExist('.oxfmtrc.json');
    checkFilesDoNotExist('.prettierrc');
    expect(readJson('package.json').devDependencies).toHaveProperty('oxfmt');

    // A freshly created workspace must already satisfy its own formatter.
    expect(() => runCLI('format:check')).not.toThrow();

    updateFile('unformatted.ts', `const   x={a:1,   b:'hello'}\n`);

    const checkOutput = runCLI('format:check --all', { silenceError: true });
    expect(checkOutput).toContain('unformatted.ts');

    runCLI('format:write --all');

    // The generated .oxfmtrc.json pins Nx's style, so oxfmt must apply it
    // rather than falling back to its own defaults (which are double quotes).
    expect(readFile('unformatted.ts')).toContain(
      `const x = { a: 1, b: 'hello' };`
    );

    expect(() => runCLI('format:check --all')).not.toThrow();
  });

  it('should not fail format when no formatter is configured', () => {
    const wsName = uniq('noformatter');
    runCreateWorkspace(wsName, {
      preset: 'ts',
      packageManager,
      formatter: 'none',
    });

    checkFilesDoNotExist('.oxfmtrc.json', '.prettierrc');

    // Workspaces with no formatter must degrade to a warning. Exiting non-zero
    // here is what broke `nx release` for non-prettier repos (#30403).
    const output = runCLI('format:check --all', { silenceError: true });
    expect(output).toContain('No formatter configured');

    expect(() => runCLI('format:write --all')).not.toThrow();
  });
});
