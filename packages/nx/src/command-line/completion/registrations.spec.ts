import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  setWorkspaceRoot,
  workspaceRoot as currentWorkspaceRoot,
} from '../../utils/workspace-root';
import * as projectGraphModule from '../../project-graph/project-graph';

import './registrations';
import { findCompletionMetadata, resolveCompletion } from './metadata';
import { getNxCommandHandlers, introspectBuilder } from './command-handlers';

// End-to-end completion tests. For each registered command we drive a
// realistic argv layout through resolveCompletion and assert the emitted
// candidates — this catches a missing registration, a wrong positional
// index, a dropped flag alias, AND a broken completer in one pass.

describe('completion/registrations', () => {
  let workspaceRoot: string;
  let originalRoot: string;
  let readGraphSpy: jest.SpyInstance;

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-registrations-spec-'));
    originalRoot = currentWorkspaceRoot;
    setWorkspaceRoot(workspaceRoot);

    readGraphSpy = jest
      .spyOn(projectGraphModule, 'readCachedProjectGraph')
      .mockImplementation(() => {
        const path = join(
          workspaceRoot,
          '.nx',
          'workspace-data',
          'project-graph.json'
        );
        if (!existsSync(path)) {
          throw new Error('No cached ProjectGraph (test fixture).');
        }
        return JSON.parse(readFileSync(path, 'utf-8'));
      });

    // Minimal workspace: two projects + one installed plugin with two
    // generators. Enough to exercise every registered path.
    writeProjectGraph({
      nodes: {
        'my-app': {
          data: { root: 'apps/my-app', targets: { build: {}, test: {} } },
        },
        'my-lib': {
          data: { root: 'libs/my-lib', targets: { build: {}, lint: {} } },
        },
      },
    });
    writeRootPackageJson({
      name: 'fixture',
      devDependencies: { '@nx/demo': '*' },
    });
    writePluginWithGenerators('@nx/demo', {
      application: {},
      library: {},
    });
  });

  afterEach(() => {
    readGraphSpy.mockRestore();
    rmSync(workspaceRoot, { recursive: true, force: true });
    setWorkspaceRoot(originalRoot);
  });

  function complete(tokens: string[]): string[] | null {
    const current = tokens[tokens.length - 1] ?? '';
    const previousToken = tokens.length >= 2 ? tokens[tokens.length - 2] : '';
    return resolveCompletion(tokens, current, previousToken);
  }

  describe('nx run', () => {
    it('completes project names with trailing : at stage 1', () => {
      expect(complete(['run', ''])?.sort()).toEqual(['my-app:', 'my-lib:']);
    });

    it('completes the chosen project’s targets at stage 2', () => {
      expect(complete(['run', 'my-app:'])?.sort()).toEqual([
        'my-app:build',
        'my-app:test',
      ]);
    });
  });

  describe('nx generate (and alias g)', () => {
    it('emits plugin names with `:` and bare generator names', () => {
      expect(complete(['g', ''])?.sort()).toEqual([
        '@nx/demo:',
        'application',
        'library',
      ]);
    });

    it('emits plugin:generator at stage 2', () => {
      expect(complete(['generate', '@nx/demo:'])?.sort()).toEqual([
        '@nx/demo:application',
        '@nx/demo:library',
      ]);
    });

    it('filters bare generator names by prefix', () => {
      expect(complete(['g', 'app'])).toEqual(['application']);
    });
  });

  describe('nx show', () => {
    it('show project completes project names', () => {
      expect(complete(['show', 'project', ''])?.sort()).toEqual([
        'my-app',
        'my-lib',
      ]);
    });

    it('show target offers project:target AND the inputs/outputs keywords', () => {
      const out = complete(['show', 'target', ''])?.sort();
      expect(out).toEqual(['inputs', 'my-app:', 'my-lib:', 'outputs']);
    });

    it('show target i<TAB> lands on `inputs`', () => {
      expect(complete(['show', 'target', 'i'])).toEqual(['inputs']);
    });

    it('show target inputs <TAB> completes project:target', () => {
      expect(complete(['show', 'target', 'inputs', ''])?.sort()).toEqual([
        'my-app:',
        'my-lib:',
      ]);
    });

    it('show target outputs <TAB> completes project:target', () => {
      expect(complete(['show', 'target', 'outputs', ''])?.sort()).toEqual([
        'my-app:',
        'my-lib:',
      ]);
    });
  });

  describe('nx add', () => {
    it('suggests @nx/* plugins prefix-filtered', () => {
      const results = complete(['add', '@nx/'])!;
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.startsWith('@nx/'))).toBe(true);
      // Source is nx-migrations.packageGroup; spot-check a couple.
      expect(results).toEqual(
        expect.arrayContaining(['@nx/react', '@nx/rspack'])
      );
    });
  });

  describe('flag-value completion', () => {
    // Each row: command, flag form, expected candidate(s) in output.
    it.each([
      ['run-many', '-p', 'my-app'],
      ['run-many', '--projects', 'my-app'],
      ['run-many', '-t', 'build'],
      ['run-many', '--target', 'build'],
      ['run-many', '--targets', 'build'],
      ['affected', '-p', 'my-app'],
      ['affected', '--projects', 'my-app'],
      ['affected', '--exclude', 'my-app'],
      ['affected', '-t', 'build'],
      ['affected', '--target', 'build'],
      ['affected', '--targets', 'build'],
      ['graph', '--focus', 'my-app'],
      ['graph', '--exclude', 'my-app'],
      ['graph', '-t', 'build'],
      ['graph', '--target', 'build'],
      ['graph', '--targets', 'build'],
      ['watch', '-p', 'my-app'],
      ['watch', '--projects', 'my-app'],
    ])('%s %s <TAB> completes %s', (cmd, flag, expected) => {
      const out = complete([cmd, flag, '']);
      expect(out).toEqual(expect.arrayContaining([expected]));
    });
  });

  describe('aliases', () => {
    // Command aliases should share metadata (by reference) with the
    // canonical command. Catches drift if someone adds a new alias and
    // forgets to point it at the same object.
    it.each([['g', 'generate']])(
      '%s shares metadata with %s',
      (alias, canonical) => {
        expect(findCompletionMetadata([alias])?.metadata).toBe(
          findCompletionMetadata([canonical])?.metadata
        );
      }
    );

    // Option-alias groups derived from yargs' own builder. For each
    // canonical option that we register a completion handler for, every
    // yargs-declared alias must also be registered with the same handler
    // reference. Auto-discovers groups so a new alias can't drift silently.
    it.each(['run-many', 'affected', 'graph', 'watch'])(
      '%s: every registered option-alias group shares a handler',
      (cmd) => {
        const handler = getNxCommandHandlers()[cmd];
        const intro = introspectBuilder(handler.builder!);
        const meta = findCompletionMetadata([cmd])?.metadata;
        expect(intro).not.toBeNull();
        expect(meta).toBeDefined();
        for (const [canonical, aliases] of intro!.aliases) {
          const fn = meta?.flags?.[canonical];
          if (!fn) continue; // we don't complete this option — OK
          for (const alias of aliases) {
            expect(meta?.flags?.[alias]).toBe(fn);
          }
        }
      }
    );
  });

  describe('infix target completion', () => {
    it('nx <target> <TAB> lists only projects that have the target', () => {
      // `lint` exists only on my-lib in the fixture.
      expect(complete(['lint', ''])).toEqual(['my-lib']);
    });

    it('nx build <TAB> lists every project with a build target', () => {
      expect(complete(['build', ''])?.sort()).toEqual(['my-app', 'my-lib']);
    });

    it('conventional fallback registers `serve` even when no project has it', () => {
      // None of the fixture projects declare `serve`, but the registration
      // is wired from the CONVENTIONAL_TARGETS fallback — completion still
      // dispatches, just returns an empty list.
      expect(complete(['serve', ''])).toEqual([]);
    });
  });

  function writeProjectGraph(graph: object): void {
    const dataDir = join(workspaceRoot, '.nx', 'workspace-data');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, 'project-graph.json'), JSON.stringify(graph));
  }

  function writeRootPackageJson(pkg: object): void {
    writeFileSync(join(workspaceRoot, 'package.json'), JSON.stringify(pkg));
  }

  function writePluginWithGenerators(
    name: string,
    generators: Record<string, unknown>
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
});
