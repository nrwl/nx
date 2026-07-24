import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../generators/tree';
import { detectFormatter, detectFormatterInTree } from './index';

describe('detectFormatterInTree', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    // The empty workspace ships a .prettierrc; remove it so each case starts
    // from a workspace with no formatter configured at all.
    tree.delete('.prettierrc');
  });

  it('should return null when nothing indicates a formatter', () => {
    expect(detectFormatterInTree(tree)).toBeNull();
  });

  it('should detect oxfmt from its config file', () => {
    tree.write('.oxfmtrc.json', '{}');

    expect(detectFormatterInTree(tree)).toBe('oxfmt');
  });

  it('should detect prettier from its config file', () => {
    tree.write('.prettierrc', '{}');

    expect(detectFormatterInTree(tree)).toBe('prettier');
  });

  it('should prefer oxfmt when both are configured', () => {
    tree.write('.oxfmtrc.json', '{}');
    tree.write('.prettierrc', '{}');

    expect(detectFormatterInTree(tree)).toBe('oxfmt');
  });

  it('should detect oxfmt from a dependency when it has no config file', () => {
    // oxfmt runs on defaults, so a config file is optional.
    tree.write(
      'package.json',
      JSON.stringify({ devDependencies: { oxfmt: '^0.60.0' } })
    );

    expect(detectFormatterInTree(tree)).toBe('oxfmt');
  });

  it('should NOT treat an installed prettier as intent to use prettier', () => {
    // Workspaces formatting with biome/dprint routinely have prettier in the
    // dependency graph. Formatting them with prettier would be wrong (#30426).
    tree.write(
      'package.json',
      JSON.stringify({ devDependencies: { prettier: '^3.6.2' } })
    );

    expect(detectFormatterInTree(tree)).toBeNull();
  });

  it('should detect prettier configured through package.json', () => {
    tree.write(
      'package.json',
      JSON.stringify({ prettier: { singleQuote: true } })
    );

    expect(detectFormatterInTree(tree)).toBe('prettier');
  });
});

describe('detectFormatter', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-formatter-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('should return null for a directory with no formatter', () => {
    writeFileSync(join(root, 'package.json'), '{}');

    expect(detectFormatter(root)).toBeNull();
  });

  it('should detect oxfmt from its config file', () => {
    writeFileSync(join(root, '.oxfmtrc.json'), '{}');

    expect(detectFormatter(root)).toBe('oxfmt');
  });

  it('should prefer oxfmt when both are configured', () => {
    writeFileSync(join(root, '.oxfmtrc.json'), '{}');
    writeFileSync(join(root, '.prettierrc'), '{}');

    expect(detectFormatter(root)).toBe('oxfmt');
  });

  it('should resolve config files against the given root, not the cwd', () => {
    writeFileSync(join(root, '.prettierrc'), '{}');

    expect(detectFormatter(root)).toBe('prettier');
    expect(
      detectFormatter(mkdtempSync(join(tmpdir(), 'nx-empty-')))
    ).toBeNull();
  });

  it('should NOT treat an installed prettier as intent to use prettier', () => {
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ devDependencies: { prettier: '^3.6.2' } })
    );

    expect(detectFormatter(root)).toBeNull();
  });
});
