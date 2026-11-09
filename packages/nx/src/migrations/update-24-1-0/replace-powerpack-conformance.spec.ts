import { describe, expect, it } from 'vitest';
import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../generators/tree';
import { readJson, updateJson, writeJson } from '../../generators/utils/json';
import { addProjectConfiguration } from '../../generators/utils/project-configuration';
import { nxVersion } from '../../utils/versions';
import update from './replace-powerpack-conformance';

describe('replace-powerpack-conformance', () => {
  function setup(rules: unknown[] = []): Tree {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      devDependencies: {
        ...json.devDependencies,
        '@nx/powerpack-conformance': '5.0.10',
      },
    }));
    updateJson(tree, 'nx.json', (json) => ({
      ...json,
      conformance: { rules },
    }));
    return tree;
  }

  it('replaces the dependency with @nx/conformance at the Nx version', async () => {
    const tree = setup();

    const result = await update(tree);

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['@nx/powerpack-conformance']).toBeUndefined();
    expect(devDependencies['@nx/conformance']).toBe(nxVersion);
    expect(result).toEqual({ skipAgentic: true });
  });

  it('keeps an existing @nx/conformance declaration', async () => {
    const tree = setup();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { '@nx/conformance': '5.0.10' },
    }));

    await update(tree);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['@nx/conformance']).toBe('5.0.10');
    expect(
      packageJson.devDependencies['@nx/powerpack-conformance']
    ).toBeUndefined();
    expect(packageJson.devDependencies['@nx/conformance']).toBeUndefined();
  });

  it('rewrites rule specifiers and moves ensure-owners to @nx/owners', async () => {
    const tree = setup([
      { rule: '@nx/powerpack-conformance/enforce-project-boundaries' },
      { rule: '@nx/powerpack-conformance/ensure-owners', status: 'evaluated' },
      { rule: './tools/rules/custom' },
    ]);

    await update(tree);

    expect(readJson(tree, 'nx.json').conformance.rules).toEqual([
      { rule: '@nx/conformance/enforce-project-boundaries' },
      { rule: '@nx/owners/ensure-owners', status: 'evaluated' },
      { rule: './tools/rules/custom' },
    ]);
    expect(readJson(tree, 'package.json').devDependencies['@nx/owners']).toBe(
      nxVersion
    );
  });

  it('does not add @nx/owners when ensure-owners is not used', async () => {
    const tree = setup([
      { rule: '@nx/powerpack-conformance/enforce-project-boundaries' },
    ]);

    await update(tree);

    expect(
      readJson(tree, 'package.json').devDependencies['@nx/owners']
    ).toBeUndefined();
  });

  it('rewrites executors and generator defaults, and adds esbuild for bundle-rules', async () => {
    const tree = setup();
    updateJson(tree, 'nx.json', (json) => ({
      ...json,
      generators: {
        '@nx/powerpack-conformance:create-rule': { directory: 'x' },
      },
    }));
    addProjectConfiguration(tree, 'rules', {
      root: 'libs/rules',
      targets: {
        build: { executor: '@nx/powerpack-conformance:bundle-rules' },
      },
    });

    await update(tree);

    expect(
      readJson(tree, 'libs/rules/project.json').targets.build.executor
    ).toBe('@nx/conformance:bundle-rules');
    expect(readJson(tree, 'nx.json').generators).toEqual({
      '@nx/conformance:create-rule': { directory: 'x' },
    });
    expect(readJson(tree, 'package.json').devDependencies.esbuild).toBe(
      '^0.25.0'
    );
  });

  it('rewrites imports in rule sources', async () => {
    const tree = setup();
    tree.write(
      'libs/rules/src/my-rule/index.ts',
      `import { createConformanceRule } from '@nx/powerpack-conformance';\nimport type { X } from '@nx/powerpack-conformance/some/path';\n`
    );

    await update(tree);

    expect(tree.read('libs/rules/src/my-rule/index.ts', 'utf-8')).toBe(
      `import { createConformanceRule } from '@nx/conformance';\nimport type { X } from '@nx/conformance/some/path';\n`
    );
  });

  it('swaps the dependency in project package.json files', async () => {
    const tree = setup();
    writeJson(tree, 'libs/rules/package.json', {
      name: 'rules',
      peerDependencies: { '@nx/powerpack-conformance': '^5.0.0' },
    });

    await update(tree);

    expect(readJson(tree, 'libs/rules/package.json').peerDependencies).toEqual({
      '@nx/conformance': nxVersion,
    });
  });

  it('does nothing when the workspace does not declare @nx/powerpack-conformance', async () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'nx.json', (json) => ({
      ...json,
      conformance: {
        rules: [
          { rule: '@nx/powerpack-conformance/enforce-project-boundaries' },
        ],
      },
    }));
    const before = tree.read('nx.json', 'utf-8');

    await update(tree);

    expect(tree.read('nx.json', 'utf-8')).toBe(before);
  });
});
