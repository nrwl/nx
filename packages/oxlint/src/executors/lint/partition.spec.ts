import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
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
  it('should give every task an entry and assign by longest matching path', () => {
    const byTask = partitionDiagnostics(
      [
        diagnostic('libs/a/src/x.ts'),
        diagnostic('libs/a/nested/src/y.ts'),
        diagnostic('libs/b/index.ts'),
      ],
      [
        { taskId: 'a:lint', paths: ['libs/a'] },
        { taskId: 'a-nested:lint', paths: ['libs/a/nested'] },
        { taskId: 'b:lint', paths: ['libs/b'] },
        { taskId: 'c:lint', paths: ['libs/c'] },
      ]
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
        { taskId: 'a:lint', paths: ['libs/a'] },
        { taskId: 'ab:lint', paths: ['libs/ab'] },
      ]
    );
    expect(byTask.get('a:lint')).toEqual([]);
    expect(byTask.get('ab:lint')).toHaveLength(1);
  });

  it('should anchor globs and single files', () => {
    const byTask = partitionDiagnostics(
      [diagnostic('libs/a/src/x.ts'), diagnostic('libs/a/tools/t.ts')],
      [
        { taskId: 'src:lint', paths: ['libs/a/src/**/*.ts'] },
        { taskId: 'tool:lint', paths: ['libs/a/tools/t.ts'] },
      ]
    );
    expect(byTask.get('src:lint')).toHaveLength(1);
    expect(byTask.get('tool:lint')).toHaveLength(1);
  });

  it('should drop a diagnostic no task owns', () => {
    const byTask = partitionDiagnostics(
      [diagnostic('tools/x.ts')],
      [{ taskId: 'a:lint', paths: ['libs/a'] }]
    );
    expect(byTask.get('a:lint')).toEqual([]);
  });
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

      const patterns = nestedProjectIgnorePatterns(
        [{ projectRoot: 'libs/a', paths: ['libs/a'] }],
        ['libs/a', 'libs/a/nested', 'libs/a/n[x]']
      );
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
  const roots = ['libs/a', 'libs/a/nested', 'libs/a/nested/deeper', 'libs/b'];

  // Anchored: a bare `nested` would also match a same-named directory the
  // outer project owns. Excluding a root already prunes everything under it,
  // so the deeper root emits no pattern of its own.
  it('should ignore nested projects that are not in the run', () => {
    expect(
      nestedProjectIgnorePatterns(
        [{ projectRoot: 'libs/a', paths: ['libs/a'] }],
        roots
      )
    ).toEqual(['--ignore-pattern=/libs/a/nested']);
  });

  it('should keep nested projects that are in the run', () => {
    expect(
      nestedProjectIgnorePatterns(
        [
          { projectRoot: 'libs/a', paths: ['libs/a'] },
          { projectRoot: 'libs/a/nested', paths: ['libs/a/nested'] },
        ],
        roots
      )
    ).toEqual(['--ignore-pattern=/libs/a/nested/deeper']);
  });

  // To Oxlint's matcher `[`, `]`, `*` and `?` are pattern syntax: an unescaped
  // `/libs/a/n[x]` is a character class matching `libs/a/nx`.
  it('should escape gitignore metacharacters in the root', () => {
    expect(
      nestedProjectIgnorePatterns(
        [{ projectRoot: 'libs/a', paths: ['libs/a'] }],
        ['libs/a', 'libs/a/n[x]']
      )
    ).toEqual(['--ignore-pattern=/libs/a/n\\[x\\]']);
  });
});
