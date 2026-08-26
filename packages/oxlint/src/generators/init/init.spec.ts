import '@nx/devkit/internal-testing-utils/mock-project-graph';

import {
  createProjectGraphAsync,
  readJson,
  readNxJson,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { FsTree } from '@nx/devkit/internal';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { initGenerator } from './init.js';

describe('initGenerator', () => {
  it('adds a root oxlint config matching what `oxlint --init` scaffolds', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await initGenerator(tree, {
      skipPackageJson: true,
      skipFormat: true,
    });

    expect(readJson(tree, '.oxlintrc.json')).toEqual({
      // Resolved from node_modules so it tracks the installed version.
      $schema: './node_modules/oxlint/configuration_schema.json',
      plugins: ['typescript', 'unicorn', 'oxc'],
      categories: { correctness: 'error' },
      rules: {},
      env: { builtin: true },
    });
  });

  it('recommends the Oxc VS Code extension when recommendations already exist', async () => {
    const tree = createTreeWithEmptyWorkspace();
    writeJson(tree, '.vscode/extensions.json', {
      recommendations: ['esbenp.prettier-vscode'],
    });

    await initGenerator(tree, {
      skipPackageJson: true,
      skipFormat: true,
    });

    expect(readJson(tree, '.vscode/extensions.json').recommendations).toEqual([
      'esbenp.prettier-vscode',
      'oxc.oxc-vscode',
    ]);
  });

  it('does not create .vscode/extensions.json when absent', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await initGenerator(tree, {
      skipPackageJson: true,
      skipFormat: true,
    });

    expect(tree.exists('.vscode/extensions.json')).toBe(false);
  });

  // Registered even though this workspace opted out of inference plugins:
  // `@nx/oxlint` has no other way to produce a task, so honouring the opt-out
  // would mean doing nothing at all.
  it('registers the plugin even when useInferencePlugins is false', async () => {
    const tree = createTreeWithEmptyWorkspace();
    updateNxJson(tree, { ...readNxJson(tree), useInferencePlugins: false });

    await initGenerator(tree, {
      skipPackageJson: true,
      skipFormat: true,
    });

    const plugins = readNxJson(tree).plugins?.map((p) =>
      typeof p === 'string' ? p : p.plugin
    );
    expect(plugins).toContain('@nx/oxlint');
  });

  // Real filesystem on purpose. `addPlugin` probes `tree.root`, so a virtual
  // tree would find nothing whatever the oxlint config situation, and this
  // would pass for the wrong reason. Here the workspace is fully on disk and
  // the *only* thing missing is `.oxlintrc.json` — which `init` writes to the
  // Tree afterwards, so the probe cannot see it. Our plugin therefore reports
  // no projects, `addPlugin` finds no conflict for any candidate, and without
  // the pre-filter it would take `lint` straight out of ESLint's hands.
  describe('target name resolution against a real workspace', () => {
    let tempFs: TempFs;
    let cwd: string;

    beforeEach(() => {
      tempFs = new TempFs('oxlint-init');
      cwd = process.cwd();
      process.chdir(tempFs.tempDir);
      tempFs.createFilesSync({
        'nx.json': JSON.stringify({ plugins: [] }),
        'package.json': JSON.stringify({ name: 'ws', devDependencies: {} }),
        'libs/lib-a/project.json': JSON.stringify({ name: 'lib-a' }),
        'libs/lib-a/src/index.ts': 'export const a = 1;',
      });
    });

    afterEach(() => {
      process.chdir(cwd);
      tempFs.cleanup();
    });

    it('should step aside when another linter already owns lint', async () => {
      const tree = new FsTree(tempFs.tempDir, false);
      (createProjectGraphAsync as jest.Mock).mockResolvedValueOnce({
        nodes: {
          'lib-a': {
            name: 'lib-a',
            type: 'lib',
            data: {
              root: 'libs/lib-a',
              targets: { lint: { executor: '@nx/eslint:lint' } },
            },
          },
        },
        dependencies: {},
      });

      await initGenerator(tree, {
        skipPackageJson: true,
        skipFormat: true,
      });

      const plugin = readNxJson(tree).plugins?.find((p) =>
        typeof p === 'string' ? false : p.plugin === '@nx/oxlint'
      ) as { plugin: string; options?: { targetName?: string } };
      expect(plugin.options?.targetName).toBe('oxlint');
    });
  });

  it.each([
    '.oxlintrc.json',
    '.oxlintrc.jsonc',
    'oxlint.config.ts',
    'oxlint.config.mts',
  ])('does not overwrite an existing %s', async (configFile) => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(configFile, '{}');

    await initGenerator(tree, {
      skipPackageJson: true,
      skipFormat: true,
    });

    expect(tree.read(configFile, 'utf-8')).toEqual('{}');
    if (configFile !== '.oxlintrc.json') {
      expect(tree.exists('.oxlintrc.json')).toBe(false);
    }
  });
});
