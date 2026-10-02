import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  excludedNestedRoots,
  nestedProjectIgnorePatterns,
  normalizeFilename,
  partitionDiagnostics,
} from './partition';
import type { OxlintDiagnostic } from './run-oxlint';

const diagnostic = (filename: string): OxlintDiagnostic => ({
  filename,
  message: 'm',
  code: 'c',
  severity: 'error',
  labels: [],
});

describe('partitionDiagnostics', () => {
  it('should give every task an entry and keep a parent off its excluded nested roots', () => {
    const byTask = partitionDiagnostics(
      [
        diagnostic('libs/a/src/x.ts'),
        diagnostic('libs/a/nested/src/y.ts'),
        diagnostic('libs/b/index.ts'),
      ],
      [
        {
          taskId: 'a:lint',
          paths: ['libs/a'],
          excludedRoots: ['libs/a/nested'],
        },
        {
          taskId: 'a-nested:lint',
          paths: ['libs/a/nested'],
          excludedRoots: [],
        },
        { taskId: 'b:lint', paths: ['libs/b'], excludedRoots: [] },
        { taskId: 'c:lint', paths: ['libs/c'], excludedRoots: [] },
      ],
      []
    );
    expect([...byTask.keys()]).toEqual([
      'a:lint',
      'a-nested:lint',
      'b:lint',
      'c:lint',
    ]);
    expect(byTask.get('a:lint').map((d) => d.filename)).toEqual([
      'libs/a/src/x.ts',
    ]);
    expect(byTask.get('a-nested:lint').map((d) => d.filename)).toEqual([
      'libs/a/nested/src/y.ts',
    ]);
    expect(byTask.get('c:lint')).toEqual([]);
  });

  it('should not match a sibling that shares a name prefix', () => {
    const byTask = partitionDiagnostics(
      [diagnostic('libs/ab/x.ts')],
      [
        { taskId: 'a:lint', paths: ['libs/a'], excludedRoots: [] },
        { taskId: 'ab:lint', paths: ['libs/ab'], excludedRoots: [] },
      ],
      []
    );
    expect(byTask.get('a:lint')).toEqual([]);
    expect(byTask.get('ab:lint')).toHaveLength(1);
  });

  // Oxlint expands no globs: `app/[id]` is a directory, not a character class.
  it('should match files and directories literally', () => {
    const byTask = partitionDiagnostics(
      [
        diagnostic('app/[id]/page.ts'),
        diagnostic('app/other/page.ts'),
        diagnostic('libs/a/tools/t.ts'),
      ],
      [
        { taskId: 'id:lint', paths: ['app/[id]'], excludedRoots: [] },
        {
          taskId: 'tool:lint',
          paths: ['libs/a/tools/t.ts'],
          excludedRoots: [],
        },
      ],
      []
    );
    expect(byTask.get('id:lint').map((d) => d.filename)).toEqual([
      'app/[id]/page.ts',
    ]);
    expect(byTask.get('tool:lint')).toHaveLength(1);
  });

  it("should give a diagnostic outside every task's paths to the outside owners", () => {
    const byTask = partitionDiagnostics(
      [diagnostic('tools/x.ts')],
      [
        { taskId: 'a:lint', paths: ['libs/a'], excludedRoots: [] },
        { taskId: 'b:lint', paths: ['libs/b'], excludedRoots: [] },
      ],
      ['b:lint']
    );
    expect(byTask.get('a:lint')).toEqual([]);
    expect(byTask.get('b:lint')).toHaveLength(1);
  });

  it('should give a diagnostic with no file to the outside owners when a task lints the workspace root', () => {
    const byTask = partitionDiagnostics(
      [diagnostic('')],
      [
        { taskId: 'root:lint', paths: ['.'], excludedRoots: [] },
        { taskId: 'a:lint', paths: ['libs/a'], excludedRoots: [] },
        { taskId: 'b:lint', paths: ['libs/b'], excludedRoots: [] },
      ],
      ['root:lint', 'a:lint']
    );
    expect(byTask.get('root:lint')).toHaveLength(1);
    expect(byTask.get('a:lint')).toHaveLength(1);
    expect(byTask.get('b:lint')).toEqual([]);
  });
});

const scope = (
  projectRoot: string,
  nestedProjectRoots: string[],
  paths = [projectRoot]
) => ({
  projectRoot,
  paths,
  excludedRoots: excludedNestedRoots(paths, nestedProjectRoots),
});

// The unit expectations above cannot see what Oxlint's matcher does with the
// emitted pattern, which is where the anchoring and escaping matter.
(process.platform === 'win32' ? describe.skip : describe)(
  'nestedProjectIgnorePatterns against a real Oxlint',
  () => {
    it('should exclude only the nested roots', () => {
      const ws = mkdtempSync(join(tmpdir(), 'oxlint-partition-'));
      const files: Record<string, string> = {
        '.oxlintrc.json': '{"rules":{}}',
        'libs/a/index.ts': 'export const a = 1;',
        'libs/a/nested/index.ts': 'export const n = 1;',
        // Owned by `a`, shares the nested root's basename: anchoring keeps it.
        'libs/a/src/nested/deep.ts': 'export const d = 1;',
        'libs/a/n[x]/index.ts': 'export const e = 1;',
        // An unescaped `/libs/a/n[x]` is a character class matching this.
        'libs/a/nx/keep.ts': 'export const k = 1;',
      };
      for (const [file, content] of Object.entries(files)) {
        mkdirSync(join(ws, dirname(file)), { recursive: true });
        writeFileSync(join(ws, file), content);
      }

      const patterns = nestedProjectIgnorePatterns([
        scope('libs/a', ['libs/a/nested', 'libs/a/n[x]']),
      ]);
      const bin = join(
        dirname(require.resolve('oxlint/package.json')),
        'bin',
        'oxlint'
      );
      const linted = execFileSync(
        process.execPath,
        [bin, '--debug=files', ...patterns, 'libs/a'],
        { cwd: ws, encoding: 'utf-8' }
      )
        .trim()
        .split('\n')
        .sort();

      expect(linted).toEqual([
        'libs/a/index.ts',
        'libs/a/nx/keep.ts',
        'libs/a/src/nested/deep.ts',
      ]);
    });
  }
);

describe('normalizeFilename', () => {
  it('should turn file URLs and absolute paths into workspace-relative ones', () => {
    expect(normalizeFilename('file:///ws/libs/a/x.ts', '/ws')).toBe(
      'libs/a/x.ts'
    );
    expect(normalizeFilename('/ws/libs/a/x.ts', '/ws')).toBe('libs/a/x.ts');
    expect(normalizeFilename('./libs/a/x.ts', '/ws')).toBe('libs/a/x.ts');
    expect(normalizeFilename('libs/a/x.ts', '/ws')).toBe('libs/a/x.ts');
  });
});

describe('nestedProjectIgnorePatterns', () => {
  // Anchored: a bare `nested` would also match a same-named directory the
  // outer project owns. Excluding a root already prunes everything under it,
  // so the deeper root emits no pattern of its own.
  it('should ignore nested projects that are not in the run', () => {
    expect(
      nestedProjectIgnorePatterns([
        scope('libs/a', ['libs/a/nested', 'libs/a/nested/deeper']),
      ])
    ).toEqual(['--ignore-pattern=/libs/a/nested']);
    expect(
      nestedProjectIgnorePatterns([scope('.', ['libs/a'], ['.'])])
    ).toEqual(['--ignore-pattern=/libs/a']);
  });

  it('should keep nested projects that are in the run', () => {
    expect(
      nestedProjectIgnorePatterns([
        scope('libs/a', ['libs/a/nested']),
        scope('libs/a/nested', ['libs/a/nested/deeper']),
      ])
    ).toEqual(['--ignore-pattern=/libs/a/nested/deeper']);
  });

  // An ignore pattern applies to the whole run, so it would hide the root from
  // a task that lints it when run on its own.
  it('should keep a nested root that another task in the run lints', () => {
    expect(
      nestedProjectIgnorePatterns([
        scope('libs/a', ['libs/a/nested']),
        scope('tools', [], ['libs']),
      ])
    ).toEqual([]);
  });

  // To Oxlint's matcher `[`, `]`, `*` and `?` are pattern syntax: an unescaped
  // `/libs/a/n[x]` is a character class matching `libs/a/nx`.
  it('should escape gitignore metacharacters in the root', () => {
    expect(
      nestedProjectIgnorePatterns([scope('libs/a', ['libs/a/n[x]'])])
    ).toEqual(['--ignore-pattern=/libs/a/n\\[x\\]']);
  });
});
