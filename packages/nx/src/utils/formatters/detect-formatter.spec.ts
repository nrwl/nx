import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../generators/tree';
import { TempFs } from '../../internal-testing-utils/temp-fs';
import { detectFormatter, detectFormatterInTree } from './index';

describe('detectFormatterInTree', () => {
  let tree: Tree;

  beforeEach(() => {
    // No formatter: this suite is about what detection reports, so a
    // pre-seeded config would answer before the code under test runs.
    tree = createTreeWithEmptyWorkspace({ formatter: 'none' });
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

  it('should prefer a prettier config over a declared oxfmt dependency', () => {
    // A config is stronger intent than a dependency, so the dependency
    // fallback ranks below both configs rather than beside the oxfmt one.
    // Otherwise a prettier workspace that pulls oxfmt in mid-migration
    // silently switches formatter.
    tree.write('.prettierrc', '{}');
    tree.write(
      'package.json',
      JSON.stringify({ devDependencies: { oxfmt: '^0.60.0' } })
    );

    expect(detectFormatterInTree(tree)).toBe('prettier');
  });

  it('should detect oxfmt from a dependency when it has no config file', () => {
    // oxfmt runs on defaults, so a config file is optional.
    tree.write(
      'package.json',
      JSON.stringify({ devDependencies: { oxfmt: '^0.60.0' } })
    );

    expect(detectFormatterInTree(tree)).toBe('oxfmt');
  });

  it('should detect oxfmt declared as a runtime dependency', () => {
    tree.write(
      'package.json',
      JSON.stringify({ dependencies: { oxfmt: '^0.60.0' } })
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
  let fs: TempFs;

  beforeEach(() => {
    fs = new TempFs('detect-formatter');
  });

  afterEach(() => {
    fs.cleanup();
  });

  it('should return null for a directory with no formatter', () => {
    fs.createFileSync('package.json', '{}');

    expect(detectFormatter(fs.tempDir)).toBeNull();
  });

  it('should detect oxfmt from its config file', () => {
    fs.createFileSync('.oxfmtrc.json', '{}');

    expect(detectFormatter(fs.tempDir)).toBe('oxfmt');
  });

  it('should prefer oxfmt when both are configured', () => {
    fs.createFileSync('.oxfmtrc.json', '{}');
    fs.createFileSync('.prettierrc', '{}');

    expect(detectFormatter(fs.tempDir)).toBe('oxfmt');
  });

  it('should prefer a prettier config over a declared oxfmt dependency', () => {
    fs.createFileSync('.prettierrc', '{}');
    fs.createFileSync(
      'package.json',
      JSON.stringify({ devDependencies: { oxfmt: '^0.60.0' } })
    );

    expect(detectFormatter(fs.tempDir)).toBe('prettier');
  });

  it('should resolve config files against the given root, not the cwd', () => {
    fs.createFileSync('.prettierrc', '{}');

    expect(detectFormatter(fs.tempDir)).toBe('prettier');

    const empty = new TempFs('detect-formatter-empty');
    try {
      expect(detectFormatter(empty.tempDir)).toBeNull();
    } finally {
      empty.cleanup();
    }
  });

  it('should detect oxfmt from a dependency when it has no config file', () => {
    // The on-disk twin of the in-tree case: oxfmt runs on defaults, so a
    // declared dependency is the only signal an unconfigured workspace gives.
    fs.createFileSync(
      'package.json',
      JSON.stringify({ devDependencies: { oxfmt: '^0.60.0' } })
    );

    expect(detectFormatter(fs.tempDir)).toBe('oxfmt');
  });

  it('should detect prettier from a config format only the shared list knows', () => {
    // The setup and detection lists have to agree; `prettier.config.ts` is one
    // of the entries a hand-maintained copy had drifted past.
    fs.createFileSync('prettier.config.ts', 'export default {};');

    expect(detectFormatter(fs.tempDir)).toBe('prettier');
  });

  it('should NOT treat an installed prettier as intent to use prettier', () => {
    fs.createFileSync(
      'package.json',
      JSON.stringify({ devDependencies: { prettier: '^3.6.2' } })
    );

    expect(detectFormatter(fs.tempDir)).toBeNull();
  });
});
