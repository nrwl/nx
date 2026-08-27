// nx's own executors.json points schemas at ./dist for the published layout,
// so resolving an nx executor (e.g. the `continuous` lookup during target
// normalization) reads build output the test task does not declare as an
// input — and which may not exist locally. Redirect those reads to the
// committed source files, which dist copies verbatim. Import this in any spec
// that resolves one of nx's own executors against the real workspace.
// Factories are inlined because vitest hoists these calls above any shared
// helper definition.

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  const { join, sep } = require('path');
  const nxPackageRoot = join(__dirname, '..', '..');
  const distDir = join(nxPackageRoot, 'dist') + sep;
  const fromSource = (p: unknown) =>
    typeof p === 'string' && p.startsWith(distDir)
      ? join(nxPackageRoot, p.slice(distDir.length))
      : p;
  return {
    ...actual,
    readFileSync: ((p: any, ...rest: any[]) =>
      (actual.readFileSync as any)(
        fromSource(p),
        ...rest
      )) as typeof actual.readFileSync,
    existsSync: ((p: any) =>
      actual.existsSync(fromSource(p) as any)) as typeof actual.existsSync,
    statSync: ((p: any, ...rest: any[]) =>
      (actual.statSync as any)(
        fromSource(p),
        ...rest
      )) as typeof actual.statSync,
  };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  const { join, sep } = require('path');
  const nxPackageRoot = join(__dirname, '..', '..');
  const distDir = join(nxPackageRoot, 'dist') + sep;
  const fromSource = (p: unknown) =>
    typeof p === 'string' && p.startsWith(distDir)
      ? join(nxPackageRoot, p.slice(distDir.length))
      : p;
  return {
    ...actual,
    readFileSync: ((p: any, ...rest: any[]) =>
      (actual.readFileSync as any)(
        fromSource(p),
        ...rest
      )) as typeof actual.readFileSync,
    existsSync: ((p: any) =>
      actual.existsSync(fromSource(p) as any)) as typeof actual.existsSync,
    statSync: ((p: any, ...rest: any[]) =>
      (actual.statSync as any)(
        fromSource(p),
        ...rest
      )) as typeof actual.statSync,
  };
});

export {};
