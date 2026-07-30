import {
  checkFilesExist,
  cleanupProject,
  newProject,
  readJson,
  runCLI,
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
    expect(target.inputs).toContain('{workspaceRoot}/.oxlintrc.json');
    // Oxlint reports to stdout and has no output-file flag, so the task
    // declares no outputs — the cache replays terminal output only. Declaring
    // one would make Nx expect a file that never appears.
    expect(target.outputs).toBeUndefined();
  });

  it('should not infer a task for a project with no lintable files', () => {
    const docs = uniq('oxlintdocs');
    updateFile(`packages/${docs}/project.json`, JSON.stringify({ name: docs }));
    updateFile(`packages/${docs}/README.md`, `# ${docs}`);

    expect(getOxlintTarget(docs)).toBeNull();
  });

  it('should pass, serve a re-run from cache, fail on a violation, then pass once fixed', () => {
    const lib = uniq('oxlintrules');
    runCLI(
      `generate @nx/js:lib packages/${lib} --linter=none --no-interactive`
    );
    // Written before the first run so every step below shares one config, and
    // the cache hit in step 2 is not just a config change being picked up.
    updateFile(
      '.oxlintrc.json',
      JSON.stringify({ rules: { 'no-debugger': 'error' } })
    );
    updateFile(
      `packages/${lib}/src/index.ts`,
      `export function clean() {\n  return 1;\n}\n`
    );

    const { name: targetName } = requireOxlintTarget(lib);
    const run = () =>
      runCLI(`run ${lib}:${targetName}`, { silenceError: true });

    // 1. clean source passes
    expect(run()).toContain(`Successfully ran target ${targetName}`);
    expect(runCLI.lastExitCode).toBe(0);

    // 2. nothing changed, so the second run is replayed from the cache. Nx
    // reports that per task as `[existing outputs match the cache, left as is]`
    // even for a target with no declared outputs, which this one is — Oxlint
    // writes no files, so terminal output is all the cache holds.
    expect(run()).toContain('existing outputs match the cache');
    expect(runCLI.lastExitCode).toBe(0);

    // 3. a violation fails the task, with Oxlint's own diagnostic rather than a
    // generic task error. Asserted on the exit code, not on the absence of nx's
    // success string: a linter that reports a violation and still exits 0 would
    // let CI go green on it.
    updateFile(
      `packages/${lib}/src/index.ts`,
      `export function boom() {\n  debugger;\n}\n`
    );
    expect(run()).toContain('no-debugger');
    expect(runCLI.lastExitCode).toBe(1);

    // 4. fixing it passes again. Deliberately not the step-1 content — that
    // would be a cache hit, which would prove the cache replays a success, not
    // that Oxlint passes on the fixed source.
    updateFile(
      `packages/${lib}/src/index.ts`,
      `export function fixed() {\n  return 2;\n}\n`
    );
    const afterFix = run();
    expect(afterFix).toContain(`Successfully ran target ${targetName}`);
    expect(afterFix).not.toContain('existing outputs match the cache');
    expect(runCLI.lastExitCode).toBe(0);
  });
});
