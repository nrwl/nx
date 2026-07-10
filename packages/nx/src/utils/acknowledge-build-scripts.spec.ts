import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createTree } from '../generators/testing-utils/create-tree';
import type { Tree } from '../generators/tree';
import { acknowledgeBuildScripts } from './acknowledge-build-scripts';

describe('acknowledgeBuildScripts', () => {
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

    acknowledgeBuildScripts(tree, 'pnpm', { 'unrs-resolver': false });

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

    acknowledgeBuildScripts(tree, 'pnpm', { cypress: true });

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

    acknowledgeBuildScripts(tree, 'pnpm', {
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

  it('should be a no-op for package managers other than pnpm', () => {
    const original = 'packages:\n  - "packages/*"\n';
    tree.write('pnpm-workspace.yaml', original);

    acknowledgeBuildScripts(tree, 'npm', { cypress: true });
    acknowledgeBuildScripts(tree, 'yarn', { cypress: true });
    acknowledgeBuildScripts(tree, 'bun', { cypress: true });

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toBe(original);
  });

  it('should create pnpm-workspace.yaml when it does not exist', () => {
    acknowledgeBuildScripts(tree, 'pnpm', { cypress: true });

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toMatchInlineSnapshot(`
      "allowBuilds:
        cypress: true
      "
    `);
  });

  it('should be a no-op for pnpm < 11', () => {
    tree.write(
      'package.json',
      JSON.stringify({ name: 'proj', packageManager: 'pnpm@10.28.2' })
    );
    const original = 'onlyBuiltDependencies:\n  - nx\n';
    tree.write('pnpm-workspace.yaml', original);

    acknowledgeBuildScripts(tree, 'pnpm', { 'unrs-resolver': false });

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toBe(original);
  });

  it('should leave a malformed pnpm-workspace.yaml untouched', () => {
    const original = '- just\n- a\n- list\n';
    tree.write('pnpm-workspace.yaml', original);

    acknowledgeBuildScripts(tree, 'pnpm', { 'unrs-resolver': false });

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

      acknowledgeBuildScripts(root, 'pnpm', { nx: true });

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
