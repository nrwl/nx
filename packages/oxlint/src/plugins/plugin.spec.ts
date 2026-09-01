import { CreateDependenciesContext, CreateNodesContext } from '@nx/devkit';
import { minimatch } from 'minimatch';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { mkdirSync, rmSync } from 'node:fs';
import {
  createDependencies,
  createNodesV2,
  OxlintPluginOptions,
} from './plugin.js';

jest.mock('nx/src/utils/cache-directory', () => ({
  ...jest.requireActual('nx/src/utils/cache-directory'),
  workspaceDataDirectory: 'tmp/oxlint-project-graph-cache',
}));

const LINTABLE_FILES =
  '{projectRoot}/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue,svelte,astro}';

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

  it('should not create a target for a config-owning project with no lintable files', async () => {
    createFiles({
      '.oxlintrc.json': `{"rules":{}}`,
      'libs/docs/project.json': `{"name":"docs"}`,
      'libs/docs/.oxlintrc.json': `{"rules":{}}`,
      'libs/docs/README.md': `# docs`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);

    // Owning a config is not enough: `oxlint` exits 1 with "No files found to
    // lint" in a directory it has nothing to read.
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
        // Without this the task stops hashing the project's own source, so Nx
        // replays a cached pass after an edit.
        { fileset: LINTABLE_FILES },
        '{workspaceRoot}/.oxlintrc.json',
        '{workspaceRoot}/configs/base.json',
        { externalDependencies: ['oxlint'] },
      ])
    );
  });

  // Oxlint cannot lint a README or a JSON file, and no named input is used,
  // so a workspace's `default` definition does not decide what re-lints.
  it('should hash only lintable files and not use named inputs', async () => {
    createFiles({
      '.oxlintrc.json': `{"rules":{}}`,
      'libs/a/project.json': `{"name":"a"}`,
      'libs/a/src/index.ts': `export const a = 1;`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);
    const inputs = results.projects['libs/a'].targets.lint.inputs;

    expect(inputs.filter((i) => typeof i === 'string')).not.toContain(
      'default'
    );
    expect(inputs).not.toContain('^default');
    expect(inputs).toContainEqual({ fileset: LINTABLE_FILES });
    expect(inputs).toContainEqual({
      fileset:
        '{projectRoot}/**/{.oxlintrc.json,.oxlintrc.jsonc,oxlint.config.ts,oxlint.config.mts,.eslintignore,.gitignore,tsconfig*.json}',
    });
  });

  // Only the boundaries bridge reads other projects, so without it a change
  // in a dependency must not re-lint the dependents.
  it('should not hash dependencies without the boundaries bridge', async () => {
    createFiles({
      '.oxlintrc.json': `{"rules":{}}`,
      'libs/a/project.json': `{"name":"a"}`,
      'libs/a/src/index.ts': `export const a = 1;`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);
    const inputs = results.projects['libs/a'].targets.lint.inputs;

    expect(inputs.some((i) => (i as any).dependencies === true)).toBe(false);
  });

  it('should hash dependencies when the boundaries bridge is configured', async () => {
    createFiles({
      '.oxlintrc.json': `{"jsPlugins":["@nx/oxlint/boundaries-plugin"],"rules":{}}`,
      'libs/a/project.json': `{"name":"a"}`,
      'libs/a/src/index.ts': `export const a = 1;`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);
    const inputs = results.projects['libs/a'].targets.lint.inputs;

    expect(inputs).toContainEqual({
      fileset: LINTABLE_FILES,
      dependencies: true,
    });
    expect(inputs).toContainEqual({
      fileset: '{projectRoot}/package.json',
      dependencies: true,
    });
  });

  // Oxlint layers ignore files from every ancestor of a linted file, which
  // changes which files are linted.
  it.each(['.eslintignore', '.gitignore'])(
    'should declare ancestor %s files as inputs',
    async (filename) => {
      createFiles({
        '.oxlintrc.json': `{"rules":{}}`,
        'libs/a/project.json': `{"name":"a"}`,
        'libs/a/src/index.ts': `export const a = 1;`,
      });

      const results = await invokeCreateNodesOnMatchingFiles(context);
      const inputs = results.projects['libs/a'].targets.lint.inputs;

      expect(inputs).toContain(`{workspaceRoot}/${filename}`);
      expect(inputs).toContain(`{workspaceRoot}/libs/${filename}`);
      // The project's own directory is covered by its own fileset.
      expect(inputs).not.toContain(`{workspaceRoot}/libs/a/${filename}`);
    }
  );

  // Oxlint lints every file below the directory it runs in, so without this a
  // nested project's files are linted twice and hashed only by the inner task.
  it('should exclude nested projects from the outer lint', async () => {
    createFiles({
      '.oxlintrc.json': `{"rules":{}}`,
      'libs/a/project.json': `{"name":"a"}`,
      'libs/a/src/index.ts': `export const a = 1;`,
      'libs/a/nested/project.json': `{"name":"a-nested"}`,
      'libs/a/nested/src/index.ts': `export const n = 1;`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);

    expect(results.projects['libs/a'].targets.lint.command).toBe(
      'oxlint --ignore-pattern nested/** .'
    );
    // The nested project still lints its own files, through its own target.
    expect(results.projects['libs/a/nested'].targets.lint.command).toBe(
      'oxlint .'
    );
  });

  it('should declare local jsPlugins as file inputs but never as externalDependencies', async () => {
    createFiles({
      '.oxlintrc.json': `{"jsPlugins":["@nx/oxlint/boundaries-plugin","./tools/local-plugin.js",{"name":"acme","specifier":"@acme/oxlint-plugin"},{"name":"local","specifier":"./tools/other-plugin.js"}],"rules":{}}`,
      'tools/local-plugin.js': `export default { meta: {}, rules: {} };`,
      'tools/other-plugin.js': `export default { meta: {}, rules: {} };`,
      'libs/a/project.json': `{"name":"a"}`,
      'libs/a/src/index.ts': `export const a = 1;`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);
    const inputs = results.projects['libs/a'].targets.lint.inputs;

    // A local plugin may live outside every project, where no graph edge can
    // reach it. Packages are graph edges (see createDependencies), never
    // externalDependencies: naming one with no node fails every task.
    expect(inputs).toContain('{workspaceRoot}/tools/local-plugin.js');
    expect(inputs).toContain('{workspaceRoot}/tools/other-plugin.js');
    expect(inputs).toContainEqual({ externalDependencies: ['oxlint'] });
  });

  it('should not declare a local jsPlugin outside the workspace as an input', async () => {
    createFiles({
      '.oxlintrc.json': `{"jsPlugins":["../outside/plugin.js","./tools/inside.js"],"rules":{}}`,
      'tools/inside.js': `export default { meta: {}, rules: {} };`,
      'libs/a/project.json': `{"name":"a"}`,
      'libs/a/src/index.ts': `export const a = 1;`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);
    const inputs = results.projects['libs/a'].targets.lint.inputs;

    expect(inputs).toContain('{workspaceRoot}/tools/inside.js');
    expect(inputs.some((i) => String(i).includes('outside'))).toBe(false);
  });

  it('should declare local jsPlugins of an extended config as file inputs', async () => {
    createFiles({
      '.oxlintrc.json': `{"extends":["./configs/base.json"],"rules":{}}`,
      'configs/base.json': `{"jsPlugins":["./plugin.js"],"rules":{}}`,
      'configs/plugin.js': `export default { meta: {}, rules: {} };`,
      'libs/a/project.json': `{"name":"a"}`,
      'libs/a/src/index.ts': `export const a = 1;`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);

    expect(results.projects['libs/a'].targets.lint.inputs).toContain(
      '{workspaceRoot}/configs/plugin.js'
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
      // A config under a different Oxlint root is not this project's input.
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

  // Without the root short-circuit, `lintPath` falls through to `.` and the root
  // project gets `oxlint .`, re-linting every sub-project on top of its own target.
  it('should not give a root project a task when it has no src or lib', async () => {
    createFiles({
      '.oxlintrc.json': `{"rules":{}}`,
      'package.json': `{"name":"root-workspace","nx":{}}`,
      'index.ts': `export const value = 1;`,
      'libs/a/project.json': `{"name":"a"}`,
      'libs/a/index.ts': `export const a = 1;`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);

    expect(Object.keys(results.projects)).toEqual(['libs/a']);
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

  // Ported from `@nx/eslint`'s plugin.spec.ts, whose implementation this one
  // mirrors. Type-aware Oxlint reads the tsconfig, so a shared config changing
  // must dirty the project — a regression here replays a cached pass instead.
  describe('tsconfig extends chain inputs', () => {
    it('should not add tsconfig inputs when the project has no tsconfig.json', async () => {
      createFiles({
        '.oxlintrc.json': `{"rules":{}}`,
        'libs/a/project.json': `{"name":"a"}`,
        'libs/a/src/index.ts': `export const a = 1;`,
      });

      const results = await invokeCreateNodesOnMatchingFiles(context);

      expect(results.projects['libs/a'].targets.lint.inputs).not.toContainEqual(
        expect.stringContaining('tsconfig')
      );
    });

    it('should not add tsconfig inputs when tsconfig.json has no extends', async () => {
      createFiles({
        '.oxlintrc.json': `{"rules":{}}`,
        'libs/a/project.json': `{"name":"a"}`,
        'libs/a/src/index.ts': `export const a = 1;`,
        'libs/a/tsconfig.json': `{}`,
      });

      const results = await invokeCreateNodesOnMatchingFiles(context);

      expect(results.projects['libs/a'].targets.lint.inputs).not.toContainEqual(
        expect.stringContaining('tsconfig')
      );
    });

    it('should not add tsconfig inputs when extends points inside the project root', async () => {
      createFiles({
        '.oxlintrc.json': `{"rules":{}}`,
        'libs/a/project.json': `{"name":"a"}`,
        'libs/a/src/index.ts': `export const a = 1;`,
        'libs/a/tsconfig.json': JSON.stringify({
          extends: './tsconfig.lib.json',
        }),
        'libs/a/tsconfig.lib.json': `{}`,
      });

      const results = await invokeCreateNodesOnMatchingFiles(context);

      expect(results.projects['libs/a'].targets.lint.inputs).not.toContainEqual(
        expect.stringContaining('tsconfig')
      );
    });

    // The native selective hasher already covers the root tsconfig.
    it('should exclude the root tsconfig from inputs', async () => {
      createFiles({
        '.oxlintrc.json': `{"rules":{}}`,
        'tsconfig.base.json': `{}`,
        'libs/a/project.json': `{"name":"a"}`,
        'libs/a/src/index.ts': `export const a = 1;`,
        'libs/a/tsconfig.json': JSON.stringify({
          extends: '../../tsconfig.base.json',
        }),
      });

      const results = await invokeCreateNodesOnMatchingFiles(context);

      expect(results.projects['libs/a'].targets.lint.inputs).not.toContain(
        '{workspaceRoot}/tsconfig.base.json'
      );
    });

    // The node_modules skip is this plugin's own code, not the shared
    // `walkTsconfigExtendsChain` — so nothing else pins it. The lockfile
    // already invalidates on an external package change.
    it('should drop shareable tsconfig packages resolved from node_modules', async () => {
      createFiles({
        '.oxlintrc.json': `{"rules":{}}`,
        'node_modules/@some/preset/package.json': `{"name":"@some/preset"}`,
        'node_modules/@some/preset/tsconfig.json': `{}`,
        'libs/a/project.json': `{"name":"a"}`,
        'libs/a/src/index.ts': `export const a = 1;`,
        'libs/a/tsconfig.json': JSON.stringify({
          extends: '@some/preset/tsconfig.json',
        }),
      });

      const results = await invokeCreateNodesOnMatchingFiles(context);
      const inputs = results.projects['libs/a'].targets.lint.inputs;

      expect(inputs).not.toContainEqual(
        expect.stringContaining('node_modules')
      );
      expect(inputs).not.toContainEqual(
        expect.stringContaining('@some/preset')
      );
    });

    it('should add the tsconfig to inputs when extends points outside the project root', async () => {
      createFiles({
        '.oxlintrc.json': `{"rules":{}}`,
        'tsconfig.shared.json': `{}`,
        'libs/a/project.json': `{"name":"a"}`,
        'libs/a/src/index.ts': `export const a = 1;`,
        'libs/a/tsconfig.json': JSON.stringify({
          extends: '../../tsconfig.shared.json',
        }),
      });

      const results = await invokeCreateNodesOnMatchingFiles(context);

      expect(results.projects['libs/a'].targets.lint.inputs).toContain(
        '{workspaceRoot}/tsconfig.shared.json'
      );
    });
  });

  describe('createDependencies', () => {
    const external = (name: string) => ({
      [`npm:${name}`]: {
        name: `npm:${name}`,
        type: 'npm' as const,
        data: { packageName: name, version: '1.0.0' },
      },
    });
    const lintedProject = (root: string) => ({
      root,
      targets: { lint: { metadata: { technologies: ['oxlint'] } } },
    });

    function depsContext(
      projects: Record<string, any>,
      externalNodes: Record<string, any>,
      files: string[]
    ): CreateDependenciesContext {
      const projectFileMap: Record<string, { file: string; hash: string }[]> =
        {};
      const nonProjectFiles: { file: string; hash: string }[] = [];
      for (const file of files) {
        const owner = Object.entries(projects).find(
          ([, p]) =>
            file.startsWith(`${p.root}/`) ||
            (p.root === '.' && !file.includes('/'))
        );
        const entry = { file, hash: '' };
        if (owner) {
          (projectFileMap[owner[0]] ??= []).push(entry);
        } else {
          nonProjectFiles.push(entry);
        }
      }
      const fileMap = { projectFileMap, nonProjectFiles };
      return {
        projects,
        externalNodes,
        fileMap,
        filesToProcess: fileMap,
        nxJsonConfiguration: context.nxJsonConfiguration,
        workspaceRoot: tempFs.tempDir,
      } as CreateDependenciesContext;
    }

    it('should add an implicit edge from every linted project to an npm plugin', async () => {
      createFiles({
        '.oxlintrc.json': `{"jsPlugins":["@acme/oxlint-plugin"],"rules":{}}`,
        'libs/a/src/index.ts': `export const a = 1;`,
        'libs/b/src/index.ts': `export const b = 1;`,
      });
      const ctx = depsContext(
        { a: lintedProject('libs/a'), b: lintedProject('libs/b') },
        external('@acme/oxlint-plugin'),
        ['.oxlintrc.json', 'libs/a/src/index.ts', 'libs/b/src/index.ts']
      );

      expect(await createDependencies({}, ctx)).toEqual([
        { source: 'a', target: 'npm:@acme/oxlint-plugin', type: 'implicit' },
        { source: 'b', target: 'npm:@acme/oxlint-plugin', type: 'implicit' },
      ]);
    });

    it('should resolve a package subpath and the object form to the package node', async () => {
      createFiles({
        '.oxlintrc.json': `{"jsPlugins":["@nx/oxlint/boundaries-plugin",{"name":"acme","specifier":"@acme/oxlint-plugin"}],"rules":{}}`,
        'libs/a/src/index.ts': `export const a = 1;`,
      });
      const ctx = depsContext(
        { a: lintedProject('libs/a') },
        { ...external('@nx/oxlint'), ...external('@acme/oxlint-plugin') },
        ['.oxlintrc.json', 'libs/a/src/index.ts']
      );

      expect(await createDependencies({}, ctx)).toEqual([
        { source: 'a', target: 'npm:@nx/oxlint', type: 'implicit' },
        { source: 'a', target: 'npm:@acme/oxlint-plugin', type: 'implicit' },
      ]);
    });

    it('should add an edge to the workspace project that owns a local plugin', async () => {
      createFiles({
        '.oxlintrc.json': `{"jsPlugins":["./tools/lint-plugin/src/index.js"],"rules":{}}`,
        'tools/lint-plugin/src/index.js': `export default { meta: {}, rules: {} };`,
        'libs/a/src/index.ts': `export const a = 1;`,
      });
      const ctx = depsContext(
        {
          a: lintedProject('libs/a'),
          'lint-plugin': { root: 'tools/lint-plugin' },
        },
        {},
        [
          '.oxlintrc.json',
          'tools/lint-plugin/src/index.js',
          'libs/a/src/index.ts',
        ]
      );

      // `^default` then hashes the plugin's sources, and `nx affected` follows
      // the edge — neither is possible with a file input.
      expect(await createDependencies({}, ctx)).toEqual([
        { source: 'a', target: 'lint-plugin', type: 'implicit' },
      ]);
    });

    it('should follow the extends chain and ancestor configs', async () => {
      createFiles({
        '.oxlintrc.json': `{"extends":["./configs/base.json"],"rules":{}}`,
        'configs/base.json': `{"jsPlugins":["@acme/oxlint-plugin"],"rules":{}}`,
        'libs/a/.oxlintrc.json': `{"extends":["../../.oxlintrc.json"],"rules":{}}`,
        'libs/a/src/index.ts': `export const a = 1;`,
      });
      const ctx = depsContext(
        { a: lintedProject('libs/a') },
        external('@acme/oxlint-plugin'),
        [
          '.oxlintrc.json',
          'configs/base.json',
          'libs/a/.oxlintrc.json',
          'libs/a/src/index.ts',
        ]
      );

      expect(await createDependencies({}, ctx)).toEqual([
        { source: 'a', target: 'npm:@acme/oxlint-plugin', type: 'implicit' },
      ]);
    });

    it('should skip specifiers that resolve to nothing and projects Oxlint does not lint', async () => {
      createFiles({
        '.oxlintrc.json': `{"jsPlugins":["#local-plugin","file:///abs/plugin.js","not-installed-plugin","@acme/oxlint-plugin"],"rules":{}}`,
        'libs/a/src/index.ts': `export const a = 1;`,
        'libs/b/src/index.ts': `export const b = 1;`,
      });
      const ctx = depsContext(
        { a: lintedProject('libs/a'), b: { root: 'libs/b', targets: {} } },
        external('@acme/oxlint-plugin'),
        ['.oxlintrc.json', 'libs/a/src/index.ts', 'libs/b/src/index.ts']
      );

      expect(await createDependencies({}, ctx)).toEqual([
        { source: 'a', target: 'npm:@acme/oxlint-plugin', type: 'implicit' },
      ]);
    });

    it('should not add an edge for a config in an unrelated directory', async () => {
      createFiles({
        'libs/b/.oxlintrc.json': `{"jsPlugins":["@acme/oxlint-plugin"],"rules":{}}`,
        'libs/a/src/index.ts': `export const a = 1;`,
        'libs/b/src/index.ts': `export const b = 1;`,
      });
      const ctx = depsContext(
        { a: lintedProject('libs/a'), b: lintedProject('libs/b') },
        external('@acme/oxlint-plugin'),
        ['libs/b/.oxlintrc.json', 'libs/a/src/index.ts', 'libs/b/src/index.ts']
      );

      // libs/b's config governs libs/b only; a sibling is neither at nor
      // below it.
      expect(await createDependencies({}, ctx)).toEqual([
        { source: 'b', target: 'npm:@acme/oxlint-plugin', type: 'implicit' },
      ]);
    });

    it('should return nothing when no config declares jsPlugins', async () => {
      createFiles({
        '.oxlintrc.json': `{"rules":{}}`,
        'libs/a/src/index.ts': `export const a = 1;`,
      });
      const ctx = depsContext({ a: lintedProject('libs/a') }, {}, [
        '.oxlintrc.json',
        'libs/a/src/index.ts',
      ]);

      expect(await createDependencies({}, ctx)).toEqual([]);
    });
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
