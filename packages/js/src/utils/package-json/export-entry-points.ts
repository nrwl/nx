import { posix } from 'node:path';

// An array resolves to its first resolvable item and a conditions object to
// its "default" condition, as in the Angular library builder. The file
// extension isn't checked.
export function resolveExportTarget(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const target = resolveExportTarget(item);
      if (target) {
        return target;
      }
    }
    return undefined;
  }
  if (typeof value === 'object' && value !== null) {
    return resolveExportTarget((value as Record<string, unknown>).default);
  }
  return undefined;
}

// The Angular library builder compiles an export whose target is a .ts or .mts
// file.
export function isLibraryBuilderEntryFile(target: string): boolean {
  return /(?<!\.d)\.m?ts$/.test(target);
}

// The subpath names the directory of an entry point only when the target is a
// file the library builder compiles inside it. Both paths are relative to the
// same directory.
export function isEntryPointDirectoryExport(
  subpath: string,
  target: string
): boolean {
  if (!isLibraryBuilderEntryFile(target)) {
    return false;
  }
  const relativeTarget = posix.relative(subpath, target);
  return (
    relativeTarget !== '' &&
    relativeTarget !== '..' &&
    !relativeTarget.startsWith('../') &&
    !posix.isAbsolute(relativeTarget)
  );
}
