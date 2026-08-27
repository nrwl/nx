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
 * Scope: only what a unit test structurally cannot cover — `nx add` against a
 * real workspace, and a real Oxlint binary running through Nx's cache. Target
 * inference itself is covered by `plugin.spec.ts` in `packages/oxlint`.
 */

/**
 * Looks the Oxlint target up by the technology it declares, not by name. The
 * name depends on whether ESLint already owns `lint` in the generated
 * workspace, and asserting on a guessed name silently tests ESLint instead.
 */
function requireOxlintTarget(project: string): string {
  const { targets } = JSON.parse(runCLI(`show project ${project} --json`));
  const entry = Object.entries<Record<string, any>>(targets ?? {}).find(
    ([, target]) => target.metadata?.technologies?.includes('oxlint')
  );
  if (!entry) {
    throw new Error(
      `No Oxlint target on "${project}". Targets: ${JSON.stringify(
        targets,
        null,
        2
      )}`
    );
  }
  return entry[0];
}

/**
 * Runs the task expecting it to fail, and returns what it printed. `runCLI`
 * throws on a non-zero exit and carries the output on the error, so this
 * asserts the failure without `silenceError` hiding it.
 */
function runExpectingFailure(command: string): string {
  try {
    runCLI(command);
  } catch (e: any) {
    return stripAnsi(`${e.stdout ?? ''}${e.stderr ?? ''}`);
  }
  throw new Error(`Expected "${command}" to fail, but it succeeded.`);
}

// `runCLI` sets FORCE_COLOR=false, which picocolors reads as "forced on".
function stripAnsi(output: string): string {
  return output.replace(/\x1b\[[0-9;]*m/g, '');
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

  it('should make jsPlugins dependencies of every linted project', () => {
    const lib = uniq('oxlintlinted');
    const plugin = uniq('oxlintplugin');
    runCLI(
      `generate @nx/js:lib packages/${lib} --linter=oxlint --unitTestRunner=none --no-interactive`
    );
    runCLI(
      `generate @nx/js:lib packages/${plugin} --linter=none --unitTestRunner=none --no-interactive`
    );
    updateFile(
      `packages/${plugin}/src/index.js`,
      `export default { meta: { name: 'local' }, rules: {} };\n`
    );
    updateFile(
      '.oxlintrc.json',
      JSON.stringify({
        jsPlugins: [
          '@nx/oxlint/boundaries-plugin',
          `./packages/${plugin}/src/index.js`,
        ],
        rules: {},
      })
    );

    // A workspace plugin is a project edge, so editing it marks every project
    // it lints as affected — the behavior a hand-maintained input list cannot
    // give.
    expect(
      runCLI(`show projects --affected --files=packages/${plugin}/src/index.js`)
    ).toContain(lib);
    runCLI('graph --file=plugin-graph.json');
    expect(
      readJson('plugin-graph.json').graph.dependencies[lib]
    ).toContainEqual({ source: lib, target: plugin, type: 'implicit' });

    // `graph --file` leaves npm nodes out, so the package edge is read from
    // the graph Nx stores.
    expect(
      readJson('.nx/workspace-data/project-graph.json').dependencies[lib]
    ).toContainEqual({
      source: lib,
      target: 'npm:@nx/oxlint',
      type: 'implicit',
    });
  });

  it('should pass, serve a re-run from cache, fail on a violation, then pass once fixed', () => {
    const lib = uniq('oxlintrules');
    // Both runners are explicit so this does not depend on what the workspace
    // defaults to — `--unitTestRunner` would otherwise resolve to jest here and
    // pull in a package this suite never installs.
    runCLI(
      `generate @nx/js:lib packages/${lib} --linter=oxlint --unitTestRunner=none --no-interactive`
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

    const targetName = requireOxlintTarget(lib);
    const command = `run ${lib}:${targetName}`;

    // 1. clean source passes. `runCLI` throws on a non-zero exit, so getting
    //    this far is itself the check that the task succeeded.
    expect(runCLI(command)).toContain(`Successfully ran target ${targetName}`);

    // 2. nothing changed, so the second run is replayed from the cache. Nx
    // reports that per task as `[existing outputs match the cache, left as is]`
    // even for a target with no declared outputs, which this one is — Oxlint
    // writes no files, so terminal output is all the cache holds.
    expect(runCLI(command)).toContain('existing outputs match the cache');

    // 3. a violation fails the task, with Oxlint's own diagnostic rather than a
    // generic task error. The task must actually exit non-zero: a linter that
    // reports a violation and still exits 0 would let CI go green on it.
    updateFile(
      `packages/${lib}/src/index.ts`,
      `export function boom() {\n  debugger;\n}\n`
    );
    expect(runExpectingFailure(command)).toContain('no-debugger');

    // 4. fixing it passes again. Deliberately not the step-1 content — that
    // would be a cache hit, which would prove the cache replays a success, not
    // that Oxlint passes on the fixed source.
    updateFile(
      `packages/${lib}/src/index.ts`,
      `export function fixed() {\n  return 2;\n}\n`
    );
    const afterFix = runCLI(command);
    expect(afterFix).toContain(`Successfully ran target ${targetName}`);
    expect(afterFix).not.toContain('existing outputs match the cache');
  });

  it('should lint several projects in one batch and still report per project', () => {
    const clean = uniq('oxlintclean');
    const broken = uniq('oxlintbroken');
    for (const lib of [clean, broken]) {
      runCLI(
        `generate @nx/js:lib packages/${lib} --linter=oxlint --unitTestRunner=none --no-interactive`
      );
    }
    updateFile(
      '.oxlintrc.json',
      JSON.stringify({ rules: { 'no-debugger': 'error' } })
    );
    updateFile(
      `packages/${broken}/src/index.ts`,
      `export function boom() {\n  debugger;\n}\n`
    );
    const targetName = requireOxlintTarget(clean);
    const command = `run-many -t ${targetName} -p ${clean},${broken}`;

    // 1. one Oxlint process for both projects, and only the broken one fails.
    const output = runExpectingFailure(command);
    expect(output).toContain(`Running 2 tasks with @nx/oxlint:lint`);
    expect(output).toContain(`packages/${broken}/src/index.ts`);
    expect(output).toContain('no-debugger');
    expect(output).toContain(`- ${broken}:${targetName}`);
    expect(output).not.toContain(`- ${clean}:${targetName}`);

    // 2. the passing project's result was cached on its own.
    expect(runCLI(`run ${clean}:${targetName}`)).toContain(
      'existing outputs match the cache'
    );

    // 3. without batching the same diagnostic is reported the same way.
    const unbatched = runExpectingFailure(
      `${command} --batch=false --skip-nx-cache`
    );
    expect(unbatched).not.toContain('Running 2 tasks with');
    expect(unbatched).toContain(`packages/${broken}/src/index.ts`);
    expect(unbatched).toContain('no-debugger');

    // 4. a CLI flag reaches Oxlint: a config with no rules finds nothing.
    updateFile('empty.oxlintrc.json', JSON.stringify({ rules: {} }));
    expect(
      runCLI(`${command} --config=empty.oxlintrc.json --skip-nx-cache`)
    ).toContain(`Successfully ran target ${targetName}`);
  });
});
