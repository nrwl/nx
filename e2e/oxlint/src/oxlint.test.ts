import {
  checkFilesExist,
  cleanupProject,
  newProject,
  readJson,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

/**
 * Looks the Oxlint target up by the technology it declares, not by name. The
 * name depends on whether ESLint already owns `lint` in the generated
 * workspace, and asserting on a guessed name silently tests ESLint instead.
 */
function getOxlintTarget(project: string): {
  name: string;
  target: Record<string, any>;
} | null {
  const { targets } = JSON.parse(runCLI(`show project ${project} --json`));
  const entry = Object.entries<Record<string, any>>(targets ?? {}).find(
    ([, target]) => target.metadata?.technologies?.includes('oxlint')
  );
  return entry ? { name: entry[0], target: entry[1] } : null;
}

function requireOxlintTarget(project: string) {
  const found = getOxlintTarget(project);
  if (!found) {
    const { targets } = JSON.parse(runCLI(`show project ${project} --json`));
    throw new Error(
      `No Oxlint target on "${project}". Targets: ${JSON.stringify(
        targets,
        null,
        2
      )}`
    );
  }
  return found;
}

/** `nx show project` resolves inferred command targets onto `nx:run-commands`. */
function commandOf(target: Record<string, any>): string {
  return target.command ?? target.options?.command ?? '';
}

describe('Oxlint', () => {
  beforeAll(() => {
    newProject({ packages: ['@nx/oxlint', '@nx/js'] });
    runCLI('add @nx/oxlint');
  });

  afterAll(() => cleanupProject());

  it('should register the plugin and write a root config', () => {
    checkFilesExist('.oxlintrc.json');

    const nxJson = readJson('nx.json');
    expect(
      nxJson.plugins.some(
        (p: string | { plugin: string }) =>
          (typeof p === 'string' ? p : p.plugin) === '@nx/oxlint'
      )
    ).toBe(true);
  });

  it('should infer a cached Oxlint task distinct from any ESLint task', () => {
    const lib = uniq('oxlintlib');
    runCLI(
      `generate @nx/js:lib packages/${lib} --linter=none --no-interactive`
    );

    const { target } = requireOxlintTarget(lib);

    expect(commandOf(target)).toMatch(/^oxlint\b/);
    expect(target.cache).toBe(true);
    expect(target.inputs).toContainEqual({ externalDependencies: ['oxlint'] });
    // Discriminates against an ESLint-inferred target, which declares `eslint`.
    expect(target.inputs).not.toContainEqual({
      externalDependencies: ['eslint'],
    });
    expect(target.inputs).toContain('{workspaceRoot}/.oxlintrc.json');
  });

  it('should not infer a task for a project with no lintable files', () => {
    const docs = uniq('oxlintdocs');
    updateFile(`packages/${docs}/project.json`, JSON.stringify({ name: docs }));
    updateFile(`packages/${docs}/README.md`, `# ${docs}`);

    expect(getOxlintTarget(docs)).toBeNull();
  });

  it('should pass on clean source and report the violated rule on dirty source', async () => {
    const lib = uniq('oxlintrules');
    runCLI(
      `generate @nx/js:lib packages/${lib} --linter=none --no-interactive`
    );
    updateFile(
      `packages/${lib}/src/index.ts`,
      `export function clean() {\n  return 1;\n}\n`
    );

    const { name: targetName } = requireOxlintTarget(lib);

    expect(runCLI(`run ${lib}:${targetName}`)).toContain(
      `Successfully ran target ${targetName}`
    );

    updateFile(
      '.oxlintrc.json',
      JSON.stringify({ rules: { 'no-debugger': 'error' } })
    );
    updateFile(
      `packages/${lib}/src/index.ts`,
      `export function boom() {\n  debugger;\n}\n`
    );

    const { stdout, stderr } = await runCLIAsync(
      `run ${lib}:${targetName} --skip-nx-cache`,
      { silenceError: true }
    );

    const output = `${stdout}${stderr}`;
    // Oxlint's own diagnostic (`error eslint(no-debugger): ...`), not a
    // generic task failure, and the task must actually fail on it.
    expect(output).toContain('no-debugger');
    expect(output).not.toContain(`Successfully ran target ${targetName}`);
  });
});
