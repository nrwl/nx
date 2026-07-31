import { CreateNodesContext } from '@nx/devkit';
import { minimatch } from 'minimatch';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { mkdirSync, rmSync } from 'node:fs';
import { createNodesV2, OxlintPluginOptions } from './plugin.js';

jest.mock('nx/src/utils/cache-directory', () => ({
  ...jest.requireActual('nx/src/utils/cache-directory'),
  workspaceDataDirectory: 'tmp/oxlint-project-graph-cache',
}));

describe('@nx/oxlint plugin', () => {
  let context: CreateNodesContext;
  let tempFs: TempFs;
  let configFiles: string[] = [];

  beforeEach(async () => {
    mkdirSync('tmp/oxlint-project-graph-cache', { recursive: true });
    tempFs = new TempFs('oxlint-plugin');
    context = {
      nxJsonConfiguration: {
        // Should be overridden by the plugin.
        targetDefaults: {
          lint: {
            cache: false,
            inputs: ['foo', '^foo'],
          },
        },
        namedInputs: {
          default: ['{projectRoot}/**/*'],
        },
      },
      workspaceRoot: tempFs.tempDir,
    } as CreateNodesContext;
    tempFs.createFileSync('package-lock.json', '{}');
  });

  afterEach(() => {
    jest.resetModules();
    tempFs.cleanup();
    tempFs = null;
    rmSync('tmp/oxlint-project-graph-cache', { recursive: true, force: true });
  });

  it('should not create nodes when there is no oxlint config', async () => {
    createFiles({
      'libs/a/project.json': `{"name":"a"}`,
      'libs/a/src/index.ts': `export const a = 1;`,
    });

    expect(await invokeCreateNodesOnMatchingFiles(context)).toEqual({
      projects: {},
    });
  });

  it('should create a target for a project with lintable files', async () => {
    createFiles({
      '.oxlintrc.json': `{"rules":{}}`,
      'libs/a/project.json': `{"name":"a"}`,
      'libs/a/src/index.ts': `export const a = 1;`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);

    expect(results.projects['libs/a'].targets.lint).toMatchObject({
      command: 'oxlint .',
      options: { cwd: 'libs/a' },
      cache: true,
    });
  });

  // Oxlint reports to stdout and has no output-file flag, so the task declares
  // no outputs — the cache replays terminal output only. Declaring one would
  // make Nx expect a file that never appears.
  it('should declare no outputs', async () => {
    createFiles({
      '.oxlintrc.json': `{"rules":{}}`,
      'libs/a/project.json': `{"name":"a"}`,
      'libs/a/src/index.ts': `export const a = 1;`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);

    expect(results.projects['libs/a'].targets.lint.outputs).toBeUndefined();
  });

  it('should not create a target for a project with no lintable files', async () => {
    createFiles({
      '.oxlintrc.json': `{"rules":{}}`,
      'libs/docs/project.json': `{"name":"docs"}`,
      'libs/docs/README.md': `# docs`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);

    expect(results.projects['libs/docs']).toBeUndefined();
  });

  it('should declare the config and its extends chain as inputs', async () => {
    createFiles({
      '.oxlintrc.json': `{"extends":["./configs/base.json"],"rules":{}}`,
      'configs/base.json': `{"rules":{}}`,
      'libs/a/project.json': `{"name":"a"}`,
      'libs/a/src/index.ts': `export const a = 1;`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);

    expect(results.projects['libs/a'].targets.lint.inputs).toEqual(
      expect.arrayContaining([
        '{workspaceRoot}/.oxlintrc.json',
        '{workspaceRoot}/configs/base.json',
        { externalDependencies: ['oxlint'] },
      ])
    );
  });

  // Target `inputs` only. The separate per-project list that feeds the plugin's
  // cache key is computed elsewhere and is not observable here — mutating it
  // leaves this test green.
  it('should declare ancestor configs as inputs but not ones below the project', async () => {
    createFiles({
      '.oxlintrc.json': `{"rules":{}}`,
      'libs/.oxlintrc.json': `{"rules":{}}`,
      'libs/a/project.json': `{"name":"a"}`,
      'libs/a/src/index.ts': `export const a = 1;`,
      'libs/a/src/nested/.oxlintrc.json': `{"rules":{}}`,
      // A sibling whose path is a string prefix of the project's must not count.
      'libs/ab/.oxlintrc.json': `{"rules":{}}`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);
    const inputs = results.projects['libs/a'].targets.lint.inputs;

    expect(inputs).toEqual(
      expect.arrayContaining([
        '{workspaceRoot}/.oxlintrc.json',
        '{workspaceRoot}/libs/.oxlintrc.json',
      ])
    );
    expect(inputs).not.toContain(
      '{workspaceRoot}/libs/a/src/nested/.oxlintrc.json'
    );
    expect(inputs).not.toContain('{workspaceRoot}/libs/ab/.oxlintrc.json');
  });

  it('should create a target when using oxlint.config.mts', async () => {
    createFiles({
      'oxlint.config.mts': `export default { rules: {} };`,
      'libs/a/project.json': `{"name":"a"}`,
      'libs/a/src/index.ts': `export const a = 1;`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);

    expect(results.projects['libs/a'].targets.lint).toBeDefined();
  });

  it('should use a custom targetName', async () => {
    createFiles({
      '.oxlintrc.json': `{"rules":{}}`,
      'libs/a/project.json': `{"name":"a"}`,
      'libs/a/src/index.ts': `export const a = 1;`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context, {
      targetName: 'oxlint',
    });

    expect(results.projects['libs/a'].targets.oxlint).toBeDefined();
  });

  // The `nx` key is what makes Nx core treat a root package.json as a project
  // (`create-nodes.ts` appends it to the workspaces globs only then, and
  // `nx init` writes it). Without it there is no root project to add a target
  // to — see the test below.
  it('should point a root project at ./src', async () => {
    createFiles({
      '.oxlintrc.json': `{"rules":{}}`,
      'package.json': `{"name":"root-workspace","nx":{}}`,
      'src/index.ts': `export const value = 1;`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);

    expect(results.projects['.'].targets.lint).toMatchObject({
      command: 'oxlint ./src',
    });
  });

  it('should not invent a root project that Nx itself does not create', async () => {
    createFiles({
      '.oxlintrc.json': `{"rules":{}}`,
      // No `workspaces` and no `nx` key: Nx core creates no project for this
      // root, so inferring one here either invents a project the rest of the
      // graph does not have, or — with no `name` — fails the graph outright
      // with ProjectsWithNoNameError.
      'package.json': `{"name":"root-workspace","private":true}`,
      'src/index.ts': `export const value = 1;`,
      'libs/a/project.json': `{"name":"a"}`,
      'libs/a/index.ts': `export const a = 1;`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);

    expect(Object.keys(results.projects)).toEqual(['libs/a']);
  });

  it('should not create a node for a package.json the workspaces do not cover', async () => {
    createFiles({
      '.oxlintrc.json': `{"rules":{}}`,
      'package.json': `{"name":"root","private":true,"workspaces":["packages/*"]}`,
      'packages/a/package.json': `{"name":"a"}`,
      'packages/a/index.ts': `export const value = 1;`,
      // A bundler marker, not a project. It has no name, so promoting it to a
      // project root fails the whole graph with ProjectsWithNoNameError.
      'packages/a/src/runtime/polyfill/package.json': `{"sideEffects":true}`,
      'packages/a/src/runtime/polyfill/index.ts': `export const p = 1;`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);

    expect(Object.keys(results.projects)).toEqual(['packages/a']);
  });

  // The workspaces globs are empty for an integrated, project.json-based
  // workspace too — not only for a standalone repo — so this pins the shape the
  // "workspaces do not cover" test above cannot: that one declares
  // `workspaces`, so it stays green even if the empty-globs path admits
  // everything.
  it('should not create a node for a nameless nested package.json when no workspaces are declared', async () => {
    createFiles({
      '.oxlintrc.json': `{"rules":{}}`,
      'package.json': `{"name":"root","private":true}`,
      'libs/a/project.json': `{"name":"a"}`,
      'libs/a/index.ts': `export const value = 1;`,
      // A bundler marker, not a project. It has no name, so promoting it to a
      // project root fails the whole graph with ProjectsWithNoNameError.
      'libs/a/src/runtime/polyfill/package.json': `{"sideEffects":true}`,
      'libs/a/src/runtime/polyfill/index.ts': `export const p = 1;`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);
    const roots = Object.keys(results.projects);

    expect(roots).toContain('libs/a');
    expect(roots).not.toContain('libs/a/src/runtime/polyfill');
  });

  function createFiles(fileSys: Record<string, string>) {
    tempFs.createFilesSync(fileSys);
    configFiles = Object.keys(fileSys).filter((file) =>
      minimatch(file, createNodesV2[0], { dot: true })
    );
  }

  async function invokeCreateNodesOnMatchingFiles(
    ctx: CreateNodesContext,
    options: OxlintPluginOptions = {}
  ) {
    const aggregateProjects: Record<string, any> = {};
    const results = await createNodesV2[1](configFiles, options, ctx);
    for (const [, nodes] of results) {
      Object.assign(aggregateProjects, nodes.projects);
    }
    return { projects: aggregateProjects };
  }
});
