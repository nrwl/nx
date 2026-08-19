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

  it('should set up prettier and use it for format:check, format:write and generators', () => {
    // Prettier is the shipped default, so this is the path nearly every
    // workspace runs - and until this test it had no e2e coverage at all,
    // because the fixtures and the other cases here all pin oxfmt.
    const wsName = uniq('prettier');
    runCreateWorkspace(wsName, {
      preset: 'ts',
      packageManager,
      formatter: 'prettier',
    });

    checkFilesExist('.prettierrc');
    checkFilesDoNotExist('.oxfmtrc.json');
    expect(readJson('package.json').devDependencies).toHaveProperty('prettier');

    // A freshly created workspace must already satisfy its own formatter.
    expect(() => runCLI('format:check')).not.toThrow();

    updateFile('unformatted.ts', `const   x={a:1,   b:'hello'}\n`);

    const checkOutput = runCLI('format:check --all', { silenceError: true });
    expect(checkOutput).toContain('unformatted.ts');

    runCLI('format:write --all');

    // The generated .prettierrc pins `singleQuote`, so prettier has to apply it
    // rather than its own default of double quotes.
    expect(readFile('unformatted.ts')).toContain(
      `const x = { a: 1, b: 'hello' };`
    );

    expect(() => runCLI('format:check --all')).not.toThrow();

    // Generators format in memory through prettier's API, not the CLI, so this
    // is a different code path from everything above. Generated files failing
    // the workspace's own `format:check` is the failure it guards.
    runCLI(
      `generate @nx/js:lib packages/mylib --bundler=none --linter=none --unitTestRunner=none --no-interactive`
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
    // oxfmt CLI - has to read the config. The top-level await is what forces
    // the fallback: `require()` refuses an ESM graph containing one whatever
    // the extension, so Nx has to reach `import()`. Nothing below e2e covers
    // this, because jest's module registry cannot `require(esm)`.
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
    // exiting non-zero - at base `nx format` exited 1 with "Prettier is not
    // installed." The warning goes to stderr, so read the combined output
    // rather than runCLI's stdout-only return value.
    const { combinedOutput } = await runCommandAsync('nx format:check --all');
    expect(combinedOutput).toContain('No formatter configured');

    expect(() => runCLI('format:write --all')).not.toThrow();
  });
});
