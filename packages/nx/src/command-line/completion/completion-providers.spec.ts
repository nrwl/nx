import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  completeGenerator,
  completeProjectTarget,
  getGeneratorPluginCompletions,
  getGeneratorsForPlugin,
  getProjectNameCompletions,
  getProjectNamesWithTarget,
  getTargetNameCompletions,
} from './completion-providers';

describe('completion/completion-providers', () => {
  let workspaceRoot: string;
  let originalRoot: string | undefined;
  let originalDataDir: string | undefined;
  let originalGraphCacheDir: string | undefined;

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-completion-spec-'));
    originalRoot = process.env.NX_WORKSPACE_ROOT_PATH;
    originalDataDir = process.env.NX_WORKSPACE_DATA_DIRECTORY;
    originalGraphCacheDir = process.env.NX_PROJECT_GRAPH_CACHE_DIRECTORY;
    process.env.NX_WORKSPACE_ROOT_PATH = workspaceRoot;
    // Force providers to read the in-fixture cache directory.
    process.env.NX_WORKSPACE_DATA_DIRECTORY = join(
      workspaceRoot,
      '.nx',
      'workspace-data'
    );
    delete process.env.NX_PROJECT_GRAPH_CACHE_DIRECTORY;
  });

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true });
    restoreEnv('NX_WORKSPACE_ROOT_PATH', originalRoot);
    restoreEnv('NX_WORKSPACE_DATA_DIRECTORY', originalDataDir);
    restoreEnv('NX_PROJECT_GRAPH_CACHE_DIRECTORY', originalGraphCacheDir);
  });

  function writeProjectGraph(graph: object): void {
    const dataDir = join(workspaceRoot, '.nx', 'workspace-data');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, 'project-graph.json'), JSON.stringify(graph));
  }

  function writePluginWithGenerators(
    name: string,
    generators: Record<string, { hidden?: boolean }>
  ): void {
    const pluginDir = join(workspaceRoot, 'node_modules', name);
    mkdirSync(pluginDir, { recursive: true });
    writeFileSync(
      join(pluginDir, 'package.json'),
      JSON.stringify({ name, generators: './generators.json' })
    );
    writeFileSync(
      join(pluginDir, 'generators.json'),
      JSON.stringify({ generators })
    );
  }

  function writeRootPackageJson(pkg: object): void {
    writeFileSync(join(workspaceRoot, 'package.json'), JSON.stringify(pkg));
  }

  describe('project completions', () => {
    beforeEach(() => {
      writeProjectGraph({
        nodes: {
          'app-one': { data: { targets: { build: {}, test: {} } } },
          'app-two': { data: { targets: { build: {} } } },
          'lib-one': { data: { targets: { test: {} } } },
        },
      });
    });

    it('returns all project names when current is empty', () => {
      expect(getProjectNameCompletions('').sort()).toEqual([
        'app-one',
        'app-two',
        'lib-one',
      ]);
    });

    it('filters project names by prefix', () => {
      expect(getProjectNameCompletions('app').sort()).toEqual([
        'app-one',
        'app-two',
      ]);
      expect(getProjectNameCompletions('lib').sort()).toEqual(['lib-one']);
    });

    it('returns [] when graph is missing', () => {
      rmSync(join(workspaceRoot, '.nx'), { recursive: true, force: true });
      expect(getProjectNameCompletions('')).toEqual([]);
    });

    it('filters by target via getProjectNamesWithTarget', () => {
      expect(getProjectNamesWithTarget('', 'build').sort()).toEqual([
        'app-one',
        'app-two',
      ]);
      expect(getProjectNamesWithTarget('', 'test').sort()).toEqual([
        'app-one',
        'lib-one',
      ]);
      expect(getProjectNamesWithTarget('app', 'build').sort()).toEqual([
        'app-one',
        'app-two',
      ]);
      expect(getProjectNamesWithTarget('', 'nonexistent')).toEqual([]);
    });
  });

  describe('target completions', () => {
    beforeEach(() => {
      writeProjectGraph({
        nodes: {
          'app-one': { data: { targets: { build: {}, test: {} } } },
          'lib-one': { data: { targets: { lint: {} } } },
        },
      });
    });

    it('returns unique target names across the workspace', () => {
      expect(getTargetNameCompletions('').sort()).toEqual([
        'build',
        'lint',
        'test',
      ]);
    });

    it('restricts to one project when provided', () => {
      expect(getTargetNameCompletions('', 'app-one').sort()).toEqual([
        'build',
        'test',
      ]);
      expect(getTargetNameCompletions('', 'lib-one')).toEqual(['lint']);
    });

    it('filters by prefix', () => {
      expect(getTargetNameCompletions('bu').sort()).toEqual(['build']);
    });

    it('falls back to all workspace targets when the project does not exist', () => {
      // Documented quirk: the project-name branch only triggers when the node
      // exists in the graph; otherwise we fall through to the "all targets"
      // branch. Locked in here so any future change to that contract is
      // intentional.
      expect(getTargetNameCompletions('', 'missing').sort()).toEqual([
        'build',
        'lint',
        'test',
      ]);
    });
  });

  describe('completeProjectTarget (two-stage)', () => {
    beforeEach(() => {
      writeProjectGraph({
        nodes: {
          'app-one': { data: { targets: { build: {}, test: {} } } },
          'app-two': { data: { targets: { build: {} } } },
        },
      });
    });

    it('returns `project:` first stage when no colon is typed', () => {
      expect(completeProjectTarget('app').sort()).toEqual([
        'app-one:',
        'app-two:',
      ]);
    });

    it('returns `project:target` second stage after the colon', () => {
      expect(completeProjectTarget('app-one:').sort()).toEqual([
        'app-one:build',
        'app-one:test',
      ]);
      expect(completeProjectTarget('app-one:bu')).toEqual(['app-one:build']);
    });

    it('emits `missing:<target>` candidates when the typed project is unknown', () => {
      // Inherits the quirk from `getTargetNameCompletions` documented above —
      // unknown project ⇒ all workspace targets, prefixed with the typed name.
      expect(completeProjectTarget('missing:').sort()).toEqual([
        'missing:build',
        'missing:test',
      ]);
    });
  });

  describe('generator completions', () => {
    beforeEach(() => {
      writeRootPackageJson({
        name: 'fixture',
        devDependencies: {
          '@scoped/plugin': '*',
          'plain-plugin': '*',
          'no-generators': '*',
        },
      });
      writePluginWithGenerators('@scoped/plugin', {
        app: {},
        lib: {},
        hidden: { hidden: true },
      });
      writePluginWithGenerators('plain-plugin', {
        component: {},
      });
      // `no-generators` is a dep but has no generators.json — should be skipped.
      mkdirSync(join(workspaceRoot, 'node_modules', 'no-generators'), {
        recursive: true,
      });
      writeFileSync(
        join(workspaceRoot, 'node_modules', 'no-generators', 'package.json'),
        JSON.stringify({ name: 'no-generators' })
      );
    });

    it('lists only plugins that contribute generators', () => {
      expect(getGeneratorPluginCompletions('').sort()).toEqual([
        '@scoped/plugin',
        'plain-plugin',
      ]);
    });

    it('filters plugin names by prefix', () => {
      expect(getGeneratorPluginCompletions('@')).toEqual(['@scoped/plugin']);
      expect(getGeneratorPluginCompletions('plain')).toEqual(['plain-plugin']);
    });

    it('lists non-hidden generators for a single plugin', () => {
      expect(getGeneratorsForPlugin('@scoped/plugin', '').sort()).toEqual([
        'app',
        'lib',
      ]);
    });

    it('completeGenerator returns `plugin:` first stage, then `plugin:gen` after colon', () => {
      expect(completeGenerator('plain').sort()).toEqual(['plain-plugin:']);
      expect(completeGenerator('plain-plugin:').sort()).toEqual([
        'plain-plugin:component',
      ]);
      expect(completeGenerator('@scoped/plugin:l')).toEqual([
        '@scoped/plugin:lib',
      ]);
    });

    it('returns [] when the root package.json is missing', () => {
      rmSync(join(workspaceRoot, 'package.json'));
      expect(getGeneratorPluginCompletions('')).toEqual([]);
    });

    it('returns [] for a plugin with malformed package.json', () => {
      writeFileSync(
        join(workspaceRoot, 'node_modules', 'plain-plugin', 'package.json'),
        '{not valid json'
      );
      expect(getGeneratorsForPlugin('plain-plugin', '')).toEqual([]);
    });
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
