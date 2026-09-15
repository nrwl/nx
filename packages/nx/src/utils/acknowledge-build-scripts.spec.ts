import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createTree } from '../generators/testing-utils/create-tree';
import type { Tree } from '../generators/tree';
import {
  acknowledgeBuildScripts,
  acknowledgeDeclaredBuildScripts,
} from './acknowledge-build-scripts';
import {
  getPackageManagerVersion,
  packageRegistryView,
} from './package-manager';

vi.mock('./package-manager', async () => ({
  ...(await vi.importActual('./package-manager')),
  getPackageManagerVersion: vi.fn(),
  packageRegistryView: vi.fn(),
}));

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

  it('should preserve comments in a file that has no entries yet', () => {
    tree.write('pnpm-workspace.yaml', '# team notes\n');

    acknowledgeBuildScripts(tree, 'pnpm', { cypress: true });

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toMatchInlineSnapshot(`
      "# team notes

      allowBuilds:
        cypress: true
      "
    `);
  });

  it('should replace the placeholder stubs pnpm writes during non-strict installs', () => {
    tree.write(
      'pnpm-workspace.yaml',
      'allowBuilds:\n  unrs-resolver: set this to true or false\n  cypress: set this to true or false\n'
    );

    acknowledgeBuildScripts(tree, 'pnpm', { 'unrs-resolver': false });

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toMatchInlineSnapshot(`
      "allowBuilds:
        unrs-resolver: false
        cypress: set this to true or false
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

  it('should read a package.json that JSON.parse rejects', () => {
    // Nx reads JSON with a jsonc parser everywhere else, so a trailing comma
    // must not make this the one place that refuses the workspace.
    tree.write(
      'package.json',
      '{\n  "name": "proj",\n  "packageManager": "pnpm@11.2.2",\n}\n'
    );

    acknowledgeBuildScripts(tree, 'pnpm', { cypress: true });

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toMatchInlineSnapshot(`
      "allowBuilds:
        cypress: true
      "
    `);
  });

  it('should probe the pnpm version when the packageManager pin is not exact', () => {
    tree.write(
      'package.json',
      JSON.stringify({ name: 'proj', packageManager: 'pnpm@^11.0.0' })
    );
    vi.mocked(getPackageManagerVersion).mockReturnValueOnce('11.2.2');

    acknowledgeBuildScripts(tree, 'pnpm', { 'unrs-resolver': false });

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toMatchInlineSnapshot(`
      "allowBuilds:
        unrs-resolver: false
      "
    `);
  });

  it('should be a no-op when the pnpm version cannot be determined', () => {
    tree.write(
      'package.json',
      JSON.stringify({ name: 'proj', packageManager: 'pnpm@latest' })
    );
    vi.mocked(getPackageManagerVersion).mockImplementationOnce(() => {
      throw new Error('Cannot determine the version of pnpm.');
    });

    acknowledgeBuildScripts(tree, 'pnpm', { 'unrs-resolver': false });

    expect(tree.exists('pnpm-workspace.yaml')).toBe(false);
  });

  it('should leave a malformed pnpm-workspace.yaml untouched', () => {
    const original = '- just\n- a\n- list\n';
    tree.write('pnpm-workspace.yaml', original);

    acknowledgeBuildScripts(tree, 'pnpm', { 'unrs-resolver': false });

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toBe(original);
  });

  it('should leave a pnpm-workspace.yaml with parse errors untouched', () => {
    // Map-shaped but syntactically invalid (unclosed quote): the parsed root
    // is still a YAMLMap, but stringifying a document with errors throws.
    const original = 'packages:\n  - "apps/*\n';
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

  it('should record entries in the pnpm-workspace.yaml of a nested directory', () => {
    tree.delete('package.json');
    tree.write(
      'my-workspace/package.json',
      JSON.stringify({ name: 'proj', packageManager: 'pnpm@11.2.2' })
    );
    tree.write(
      'my-workspace/pnpm-workspace.yaml',
      'allowBuilds:\n  nx: true\n'
    );

    acknowledgeBuildScripts(tree, 'pnpm', { esbuild: false }, 'my-workspace');

    expect(tree.exists('pnpm-workspace.yaml')).toBe(false);
    expect(tree.read('my-workspace/pnpm-workspace.yaml', 'utf-8'))
      .toMatchInlineSnapshot(`
      "allowBuilds:
        nx: true
        esbuild: false
      "
    `);
  });
});

describe('acknowledgeDeclaredBuildScripts', () => {
  let tree: Tree;

  beforeEach(() => {
    vi.mocked(packageRegistryView).mockClear();
    tree = createTree();
    tree.write(
      'package.json',
      JSON.stringify({ name: 'proj', packageManager: 'pnpm@11.2.2' })
    );
    tree.write('pnpm-workspace.yaml', 'allowBuilds:\n  nx: true\n');
  });

  it('should record the decisions a package declares in its pnpm.allowBuilds field', async () => {
    vi.mocked(packageRegistryView).mockResolvedValueOnce(
      JSON.stringify({ esbuild: false, workerd: true })
    );

    const recorded = await acknowledgeDeclaredBuildScripts(
      tree,
      'pnpm',
      '@org/preset',
      '1.2.3'
    );

    expect(recorded).toBe(true);
    expect(packageRegistryView).toHaveBeenCalledWith('@org/preset', '1.2.3', [
      'pnpm.allowBuilds',
      '--json',
    ]);
    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toMatchInlineSnapshot(`
      "allowBuilds:
        nx: true
        esbuild: false
        workerd: true
      "
    `);
  });

  it('should use the highest version when a range matches several', async () => {
    vi.mocked(packageRegistryView).mockResolvedValueOnce(
      JSON.stringify([{ esbuild: false }, { esbuild: false, workerd: true }])
    );

    await acknowledgeDeclaredBuildScripts(tree, 'pnpm', '@org/preset', '^1');

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toMatchInlineSnapshot(`
      "allowBuilds:
        nx: true
        esbuild: false
        workerd: true
      "
    `);
  });

  it('should ignore declared values that are not booleans', async () => {
    vi.mocked(packageRegistryView).mockResolvedValueOnce(
      JSON.stringify({ esbuild: 'yes', workerd: true })
    );

    await acknowledgeDeclaredBuildScripts(tree, 'pnpm', '@org/preset', '1.0.0');

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toMatchInlineSnapshot(`
      "allowBuilds:
        nx: true
        workerd: true
      "
    `);
  });

  it('should report nothing recorded when the package declares no decisions', async () => {
    const original = tree.read('pnpm-workspace.yaml', 'utf-8');
    vi.mocked(packageRegistryView).mockResolvedValueOnce('');

    const recorded = await acknowledgeDeclaredBuildScripts(
      tree,
      'pnpm',
      '@org/preset',
      '1.0.0'
    );

    expect(recorded).toBe(false);
    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toBe(original);
  });

  it('should report nothing recorded when the registry lookup fails', async () => {
    const original = tree.read('pnpm-workspace.yaml', 'utf-8');
    vi.mocked(packageRegistryView).mockRejectedValueOnce(
      new Error('ERR_PNPM_FETCH_404')
    );

    const recorded = await acknowledgeDeclaredBuildScripts(
      tree,
      'pnpm',
      '@org/preset',
      './preset.tgz'
    );

    expect(recorded).toBe(false);
    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toBe(original);
  });

  it('should not query the registry for package managers other than pnpm', async () => {
    const recorded = await acknowledgeDeclaredBuildScripts(
      tree,
      'npm',
      '@org/preset',
      '1.0.0'
    );

    expect(recorded).toBe(false);
    expect(packageRegistryView).not.toHaveBeenCalled();
  });

  it('should not query the registry for pnpm < 11', async () => {
    tree.write(
      'package.json',
      JSON.stringify({ name: 'proj', packageManager: 'pnpm@10.28.2' })
    );

    const recorded = await acknowledgeDeclaredBuildScripts(
      tree,
      'pnpm',
      '@org/preset',
      '1.0.0'
    );

    expect(recorded).toBe(false);
    expect(packageRegistryView).not.toHaveBeenCalled();
  });

  it('should record into a nested directory', async () => {
    tree.delete('package.json');
    tree.delete('pnpm-workspace.yaml');
    tree.write(
      'my-workspace/package.json',
      JSON.stringify({ name: 'proj', packageManager: 'pnpm@11.2.2' })
    );
    tree.write(
      'my-workspace/pnpm-workspace.yaml',
      'allowBuilds:\n  nx: true\n'
    );
    vi.mocked(packageRegistryView).mockResolvedValueOnce(
      JSON.stringify({ esbuild: false })
    );

    await acknowledgeDeclaredBuildScripts(
      tree,
      'pnpm',
      '@org/preset',
      '1.0.0',
      'my-workspace'
    );

    expect(tree.read('my-workspace/pnpm-workspace.yaml', 'utf-8'))
      .toMatchInlineSnapshot(`
      "allowBuilds:
        nx: true
        esbuild: false
      "
    `);
  });
});
