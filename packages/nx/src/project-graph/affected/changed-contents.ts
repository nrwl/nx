import type { JsonFileChange, TsConfigChange } from '../../native';
import { getRootTsConfigFileName } from '../../plugins/js/utils/typescript';
import { JsonDiffType, jsonDiff } from '../../utils/json-diff';
import { parseJson } from '../../utils/json';
import { defaultReadFileAtRevision } from '../file-utils';
import type { FileChangeArgs } from './affected-tasks';

type ReadFileAtRevision = (file: string, revision: string | void) => string;

const ROOT_TSCONFIG_FILES = ['tsconfig.base.json', 'tsconfig.json'];

/**
 * The field paths that changed in each file, for inputs that hash only some
 * fields. `paths` is left unset when the file must count as changed whole.
 */
export function jsonFieldChanges(
  files: string[],
  fileChangeArgs: FileChangeArgs | undefined,
  read: ReadFileAtRevision = defaultReadFileAtRevision
): JsonFileChange[] {
  return files.map((file) => ({
    file,
    paths: changedFieldPaths(file, fileChangeArgs, read),
  }));
}

function changedFieldPaths(
  file: string,
  args: FileChangeArgs | undefined,
  read: ReadFileAtRevision
): string[][] | undefined {
  // As calculateFileChanges: a named file is compared as a whole.
  if (!args || args.files?.includes(file)) {
    return undefined;
  }
  const before = readJsonObject(read(file, args.base));
  const after = readJsonObject(read(file, args.head));
  if (!before || !after) {
    return undefined;
  }
  return (
    jsonDiff(before, after)
      // A container that stayed a container is fully described by its children's changes.
      .filter(
        (change) =>
          !(
            change.type === JsonDiffType.Modified &&
            sameContainer(change.value.lhs, change.value.rhs)
          )
      )
      .map((change) => change.path)
  );
}

/**
 * The root tsconfig as `TsConfiguration` hashes it, when a root tsconfig is in
 * the diff: `compilerOptions.paths` apart from the rest, as the hasher splits them.
 */
export function tsConfigChange(
  changedFiles: string[],
  fileChangeArgs: FileChangeArgs | undefined,
  selective: boolean,
  read: ReadFileAtRevision = defaultReadFileAtRevision
): TsConfigChange | undefined {
  const changed = changedFiles.filter((f) => ROOT_TSCONFIG_FILES.includes(f));
  if (!changed.length) {
    return undefined;
  }
  const everything: TsConfigChange = {
    restChanged: true,
    selective,
    pathsBefore: {},
    pathsAfter: {},
  };
  const root = getRootTsConfigFileName();
  // Another candidate changing may have switched which file is the root.
  if (
    !root ||
    !fileChangeArgs ||
    changed.some((f) => f !== root) ||
    fileChangeArgs.files?.includes(root)
  ) {
    return everything;
  }
  const before = readJsonObject(read(root, fileChangeArgs.base));
  const after = readJsonObject(read(root, fileChangeArgs.head));
  if (!before || !after) {
    return everything;
  }
  const [restBefore, pathsBefore] = splitPaths(before);
  const [restAfter, pathsAfter] = splitPaths(after);
  if (!isPathMappings(pathsBefore) || !isPathMappings(pathsAfter)) {
    return everything;
  }
  return {
    restChanged: restBefore !== restAfter,
    selective,
    pathsBefore,
    pathsAfter,
  };
}

/** Mirrors `NativeTaskHasherImpl`, which hashes the stringified rest, key order included. */
function splitPaths(tsconfig: Record<string, any>): [string, unknown] {
  const rest = structuredClone(tsconfig);
  const paths = rest.compilerOptions?.paths ?? {};
  if (rest.compilerOptions?.paths) {
    delete rest.compilerOptions.paths;
  }
  return [JSON.stringify(rest), paths];
}

function isPathMappings(value: unknown): value is Record<string, string[]> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (targets) =>
        Array.isArray(targets) && targets.every((t) => typeof t === 'string')
    )
  );
}

/** The hasher parses JSONC and hashes a non-object whole, so only an object is compared by field. */
function readJsonObject(text: string): Record<string, any> | null {
  if (!text) {
    return null;
  }
  try {
    const value = parseJson(text);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : null;
  } catch {
    return null;
  }
}

function sameContainer(lhs: unknown, rhs: unknown): boolean {
  return (
    !!lhs &&
    !!rhs &&
    typeof lhs === 'object' &&
    typeof rhs === 'object' &&
    Array.isArray(lhs) === Array.isArray(rhs)
  );
}
