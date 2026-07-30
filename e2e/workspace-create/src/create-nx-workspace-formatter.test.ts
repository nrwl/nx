import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  getSelectedPackageManager,
  readFile,
  readJson,
  removeFile,
  runCLI,
  runCommandAsync,
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

  it('should format generated files with an oxfmt.config.mts', () => {
    const wsName = uniq('oxfmtmts');
    runCreateWorkspace(wsName, {
      preset: 'ts',
      packageManager,
      formatter: 'oxfmt',
    });

    // Generators format through oxfmt's programmatic API, so Nx - not the
    // oxfmt CLI - has to read the config. `oxfmt.config.mts` is the only
    // discovered name that `require()` cannot load, and a top-level await
    // makes that certain: Nx has to fall back to `import()`. Nothing below
    // e2e covers this, because jest's module registry cannot `require(esm)`.
    removeFile('.oxfmtrc.json');
    updateFile(
      'oxfmt.config.mts',
      [
        `const printWidth = await Promise.resolve(80);`,
        `export default { singleQuote: true, printWidth, semi: false };`,
        ``,
      ].join('\n')
    );

    runCLI(
      `generate @nx/js:lib packages/mylib --bundler=none --linter=none --unitTestRunner=none --no-interactive`
    );

    // `semi: false` is neither oxfmt's default nor what the template writes,
    // so a config Nx failed to read shows up either way: an unreadable config
    // skips the batch, and a config read as empty formats on bare defaults.
    // Both leave the semicolon in place.
    expect(readFile('packages/mylib/src/index.ts')).not.toContain(';');
  });

  it('should not fail format when no formatter is configured', async () => {
    const wsName = uniq('noformatter');
    runCreateWorkspace(wsName, {
      preset: 'ts',
      packageManager,
      formatter: 'none',
    });

    checkFilesDoNotExist('.oxfmtrc.json', '.prettierrc');

    // Workspaces with no formatter must degrade to a warning rather than
    // exiting non-zero - that failure is what broke `nx release` for
    // non-prettier repos (#30403). The warning goes to stderr, so read the
    // combined output rather than runCLI's stdout-only return value.
    const { combinedOutput } = await runCommandAsync('nx format:check --all');
    expect(combinedOutput).toContain('No formatter configured');

    expect(() => runCLI('format:write --all')).not.toThrow();
  });
});
