import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createTree } from '../generators/testing-utils/create-tree';
import type { Tree } from '../generators/tree';
import { acknowledgePnpmBuildScripts } from './pnpm-allow-builds';

describe('acknowledgePnpmBuildScripts', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
    tree.write(
      'package.json',
      JSON.stringify({ name: 'proj', packageManager: 'pnpm@11.2.2' })
    );
  });

  it('should add entries to an existing allowBuilds map', () => {
    tree.write(
      'pnpm-workspace.yaml',
      'autoInstallPeers: true\nallowBuilds:\n  nx: true\n'
    );

    acknowledgePnpmBuildScripts(tree, { 'unrs-resolver': false });

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toMatchInlineSnapshot(`
      "autoInstallPeers: true
      allowBuilds:
        nx: true
        unrs-resolver: false
      "
    `);
  });

  it('should create the allowBuilds map when missing', () => {
    tree.write('pnpm-workspace.yaml', 'packages:\n  - "packages/*"\n');

    acknowledgePnpmBuildScripts(tree, { cypress: true });

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toMatchInlineSnapshot(`
      "packages:
        - "packages/*"
      allowBuilds:
        cypress: true
      "
    `);
  });

  it('should preserve comments and never overwrite existing entries', () => {
    tree.write(
      'pnpm-workspace.yaml',
      '# team notes\nallowBuilds:\n  # user explicitly allowed this\n  unrs-resolver: true\n'
    );

    acknowledgePnpmBuildScripts(tree, {
      'unrs-resolver': false,
      esbuild: false,
    });

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toMatchInlineSnapshot(`
      "# team notes
      allowBuilds:
        # user explicitly allowed this
        unrs-resolver: true
        esbuild: false
      "
    `);
  });

  it('should be a no-op for non-pnpm workspaces', () => {
    acknowledgePnpmBuildScripts(tree, { cypress: true });

    expect(tree.exists('pnpm-workspace.yaml')).toBe(false);
  });

  it('should be a no-op for pnpm < 11', () => {
    tree.write(
      'package.json',
      JSON.stringify({ name: 'proj', packageManager: 'pnpm@10.28.2' })
    );
    const original = 'onlyBuiltDependencies:\n  - nx\n';
    tree.write('pnpm-workspace.yaml', original);

    acknowledgePnpmBuildScripts(tree, { 'unrs-resolver': false });

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toBe(original);
  });

  it('should leave a malformed pnpm-workspace.yaml untouched', () => {
    const original = '- just\n- a\n- list\n';
    tree.write('pnpm-workspace.yaml', original);

    acknowledgePnpmBuildScripts(tree, { 'unrs-resolver': false });

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toBe(original);
  });

  it('should accept a filesystem root instead of a tree', () => {
    const root = mkdtempSync(join(tmpdir(), 'nx-allow-builds-'));
    try {
      writeFileSync(
        join(root, 'package.json'),
        JSON.stringify({ name: 'proj', packageManager: 'pnpm@11.2.2' })
      );
      writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "*"\n');

      acknowledgePnpmBuildScripts(root, { nx: true });

      expect(readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf-8'))
        .toMatchInlineSnapshot(`
        "packages:
          - "*"
        allowBuilds:
          nx: true
        "
      `);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
