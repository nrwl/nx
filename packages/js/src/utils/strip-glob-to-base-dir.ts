// `outputs` entries on inferred targets (e.g. from `@nx/js/typescript`) are
// cache-match patterns and may contain globs. Strip the glob portion back to
// the last path separator to recover the base output directory. Returns the
// input with trailing separators stripped when there is no glob.
export function stripGlobToBaseDir(pathWithGlob: string): string {
  const globIdx = pathWithGlob.search(/[*?[{(]/);
  if (globIdx === -1) {
    return pathWithGlob.replace(/[\\/]+$/, '');
  }
  const prefix = pathWithGlob.slice(0, globIdx);
  const lastSep = Math.max(prefix.lastIndexOf('/'), prefix.lastIndexOf('\\'));
  return lastSep === -1 ? '' : prefix.slice(0, lastSep);
}
