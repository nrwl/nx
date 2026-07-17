import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { appendMinimumReleaseAgeExcludes } from './pnpm-exclude-writer';

describe('appendMinimumReleaseAgeExcludes', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-pnpm-exclude-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function workspacePath(): string {
    return join(root, 'pnpm-workspace.yaml');
  }

  function readExcludes(): unknown {
    return parseYaml(readFileSync(workspacePath(), 'utf-8'))
      ?.minimumReleaseAgeExclude;
  }

  it('creates pnpm-workspace.yaml when absent', () => {
    expect(existsSync(workspacePath())).toBe(false);
    const added = appendMinimumReleaseAgeExcludes(root, ['pkg-a@2.0.0']);
    expect(added).toEqual(['pkg-a@2.0.0']);
    expect(existsSync(workspacePath())).toBe(true);
    expect(readExcludes()).toEqual(['pkg-a@2.0.0']);
  });

  it('appends a new key to an existing file, preserving other keys', () => {
    writeFileSync(
      workspacePath(),
      `packages:\n  - packages/*\nminimumReleaseAge: 1440\n`
    );
    appendMinimumReleaseAgeExcludes(root, ['pkg-a@2.0.0']);
    const doc = parseYaml(readFileSync(workspacePath(), 'utf-8'));
    expect(doc.packages).toEqual(['packages/*']);
    expect(doc.minimumReleaseAge).toBe(1440);
    expect(doc.minimumReleaseAgeExclude).toEqual(['pkg-a@2.0.0']);
  });

  it('appends to an existing exclude list, preserving order', () => {
    writeFileSync(
      workspacePath(),
      `minimumReleaseAgeExclude:\n  - pkg-x@1.0.0\n  - pkg-y@2.0.0\n`
    );
    const added = appendMinimumReleaseAgeExcludes(root, ['pkg-z@3.0.0']);
    expect(added).toEqual(['pkg-z@3.0.0']);
    expect(readExcludes()).toEqual([
      'pkg-x@1.0.0',
      'pkg-y@2.0.0',
      'pkg-z@3.0.0',
    ]);
  });

  it('dedupes against existing entries (no duplicate write)', () => {
    writeFileSync(
      workspacePath(),
      `minimumReleaseAgeExclude:\n  - pkg-a@2.0.0\n`
    );
    const added = appendMinimumReleaseAgeExcludes(root, [
      'pkg-a@2.0.0',
      'pkg-b@1.0.0',
    ]);
    expect(added).toEqual(['pkg-b@1.0.0']);
    expect(readExcludes()).toEqual(['pkg-a@2.0.0', 'pkg-b@1.0.0']);
  });

  it('dedupes within the incoming batch', () => {
    const added = appendMinimumReleaseAgeExcludes(root, [
      'pkg-a@2.0.0',
      'pkg-a@2.0.0',
      'pkg-b@1.0.0',
    ]);
    expect(added).toEqual(['pkg-a@2.0.0', 'pkg-b@1.0.0']);
    expect(readExcludes()).toEqual(['pkg-a@2.0.0', 'pkg-b@1.0.0']);
  });

  it('returns empty and does not touch the file when all entries already present', () => {
    writeFileSync(
      workspacePath(),
      `minimumReleaseAgeExclude:\n  - pkg-a@2.0.0\n`
    );
    const before = readFileSync(workspacePath(), 'utf-8');
    const added = appendMinimumReleaseAgeExcludes(root, ['pkg-a@2.0.0']);
    expect(added).toEqual([]);
    expect(readFileSync(workspacePath(), 'utf-8')).toBe(before);
  });

  it('returns empty for an empty entry list without creating the file', () => {
    const added = appendMinimumReleaseAgeExcludes(root, []);
    expect(added).toEqual([]);
    expect(existsSync(workspacePath())).toBe(false);
  });

  it('preserves comments in the existing file', () => {
    writeFileSync(
      workspacePath(),
      `# workspace config\npackages:\n  - packages/*\n# keep packages fresh\nminimumReleaseAge: 1440\n`
    );
    appendMinimumReleaseAgeExcludes(root, ['pkg-a@2.0.0']);
    const written = readFileSync(workspacePath(), 'utf-8');
    expect(written).toContain('# workspace config');
    expect(written).toContain('# keep packages fresh');
    expect(written).toContain('pkg-a@2.0.0');
  });

  it('handles an empty/whitespace-only existing file', () => {
    writeFileSync(workspacePath(), '\n\n');
    const added = appendMinimumReleaseAgeExcludes(root, ['pkg-a@2.0.0']);
    expect(added).toEqual(['pkg-a@2.0.0']);
    expect(readExcludes()).toEqual(['pkg-a@2.0.0']);
  });

  it('does not overwrite a present non-mapping file', () => {
    // A bare sequence/scalar root is malformed for pnpm; the writer must bail
    // rather than clobber the user's content with just the exclude key.
    const malformed = `- packages/*\n- apps/*\n`;
    writeFileSync(workspacePath(), malformed);
    const added = appendMinimumReleaseAgeExcludes(root, ['pkg-a@2.0.0']);
    expect(added).toEqual([]);
    expect(readFileSync(workspacePath(), 'utf-8')).toBe(malformed);
  });
});
