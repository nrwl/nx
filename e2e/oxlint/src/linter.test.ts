import {
  cleanupProject,
  newProject,
  readJson,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';

describe('OXLint', () => {
  const explicitLib = uniq('mylib-explicit');
  const inferredLib = uniq('mylib-inferred');
  const inferredViteLib = uniq('mylib-inferred-vite');
  const hybridLib = uniq('mylib-hybrid');

  beforeAll(() => {
    newProject({
      packages: ['@nx/js', '@nx/oxlint'],
    });
  });

  afterAll(() => {
    cleanupProject();
  });

  it('should add explicit fallback target when inference is disabled', () => {
    updateJson('nx.json', (json) => {
      json.useInferencePlugins = false;
      return json;
    });

    runCLI(`generate @nx/js:lib libs/${explicitLib} --linter none`);
    runCLI(`generate @nx/oxlint:lint-project --project ${explicitLib}`);

    const project = readJson(`libs/${explicitLib}/project.json`);
    expect(project.targets.oxlint.executor).toBe('@nx/oxlint:lint');
  });

  it('should report lint failures with @nx/oxlint:lint', () => {
    updateFile(
      `.oxlintrc.json`,
      JSON.stringify(
        {
          rules: {
            eqeqeq: 'error',
          },
        },
        null,
        2
      )
    );

    updateFile(
      `libs/${explicitLib}/src/lib/${explicitLib}.ts`,
      'export const bad = (a: number) => a == 1;\n'
    );

    const out = runCLI(`run ${explicitLib}:oxlint`, {
      silenceError: true,
      env: { CI: 'false' },
    });

    expect(out).toContain('eqeqeq');
  }, 300000);

  it('should infer an OXLint target when inference plugins are enabled', () => {
    updateJson('nx.json', (json) => {
      json.useInferencePlugins = true;
      return json;
    });

    runCLI(`generate @nx/js:lib libs/${inferredLib} --linter none`);
    runCLI(`generate @nx/oxlint:init --addPlugin`);

    const nxJson = readJson('nx.json');
    const plugin = nxJson.plugins.find((p) =>
      typeof p === 'string'
        ? p === '@nx/oxlint/plugin'
        : p.plugin === '@nx/oxlint/plugin'
    );
    const targetName =
      typeof plugin === 'string'
        ? 'oxlint'
        : (plugin.options?.targetName ?? 'oxlint');

    const project = JSON.parse(runCLI(`show project ${inferredLib} --json`));
    expect(project.targets[targetName]).toBeDefined();
  }, 300000);

  it('should run inferred target from workspace root and avoid loading project vite config', () => {
    updateJson('nx.json', (json) => {
      json.useInferencePlugins = true;
      return json;
    });

    runCLI(`generate @nx/js:lib libs/${inferredViteLib} --linter none`);
    runCLI(`generate @nx/oxlint:init --addPlugin`);

    updateFile(
      `libs/${inferredViteLib}/vite.config.ts`,
      'export default { lint: { paths: [__dirname] } };'
    );

    const nxJson = readJson('nx.json');
    const plugin = nxJson.plugins.find((p) =>
      typeof p === 'string'
        ? p === '@nx/oxlint/plugin'
        : p.plugin === '@nx/oxlint/plugin'
    );
    const targetName =
      typeof plugin === 'string'
        ? 'oxlint'
        : (plugin.options?.targetName ?? 'oxlint');

    const project = JSON.parse(
      runCLI(`show project ${inferredViteLib} --json`)
    );
    expect(project.targets[targetName].options.command).toBe(
      `oxlint libs/${inferredViteLib}`
    );
    expect(() =>
      runCLI(`run ${inferredViteLib}:${targetName}`, {
        env: { CI: 'false' },
      })
    ).not.toThrow();
  }, 300000);

  it('should cache repeated OXLint runs', () => {
    updateFile(
      `libs/${explicitLib}/src/lib/${explicitLib}.ts`,
      'export const good = (a: number) => a === 1;\n'
    );

    runCLI(`run ${explicitLib}:oxlint --verbose`, {
      env: { CI: 'false' },
    });

    const out = runCLI(`run ${explicitLib}:oxlint --verbose`, {
      env: { CI: 'false' },
    });

    expect(out).toMatch(
      /local cache|remote cache|existing outputs match the cache/
    );
  }, 300000);

  it('should keep eslint lint target and add oxlint target in hybrid migration', () => {
    updateJson('nx.json', (json) => {
      json.useInferencePlugins = false;
      return json;
    });

    runCLI(`generate @nx/js:lib libs/${hybridLib} --linter eslint`);
    runCLI(`generate @nx/oxlint:convert-from-eslint --project ${hybridLib}`);

    const project = readJson(`libs/${hybridLib}/project.json`);
    expect(project.targets.lint).toBeDefined();
    expect(project.targets.oxlint).toBeDefined();
    expect(project.targets.oxlint.executor).toBe('@nx/oxlint:lint');
  }, 300000);
});
