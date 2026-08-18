import assert from 'node:assert';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

let load: (<T>(modulePath: string | URL) => Promise<T>) | undefined;

export function loadEsmModule<T>(modulePath: string | URL): Promise<T> {
  load ??= new Function('modulePath', `return import(modulePath);`) as Exclude<
    typeof load,
    undefined
  >;

  // The dynamic import lives inside `new Function(...)` to stop TypeScript from
  // downleveling it to require(). A side effect is that bare specifiers are
  // resolved against the location of the Function rather than this module, so
  // under Node >= 26's stricter ESM resolver they fail with ERR_MODULE_NOT_FOUND
  // even for declared dependencies. Resolve bare specifiers here, where this
  // package's dependencies are reachable, and hand off an absolute file URL.
  if (typeof modulePath === 'string' && isBareSpecifier(modulePath)) {
    modulePath = pathToFileURL(require.resolve(modulePath)).href;
  }

  return load(modulePath);
}

function isBareSpecifier(specifier: string): boolean {
  return (
    !specifier.startsWith('.') &&
    !isAbsolute(specifier) &&
    !specifier.includes('://') &&
    !specifier.startsWith('node:') &&
    !specifier.startsWith('data:')
  );
}

export function assertIsError(
  value: unknown
): asserts value is Error & { code?: string } {
  const isError =
    value instanceof Error ||
    // The following is needed to identify errors coming from RxJs
    (typeof value === 'object' &&
      value &&
      'name' in value &&
      'message' in value);
  assert(isError, 'catch clause variable is not an Error instance');
}

export function isPackageInstalled(root: string, name: string): boolean {
  try {
    require.resolve(name, { paths: [root] });

    return true;
  } catch {
    return false;
  }
}

export function assertNever(input: never): never {
  throw new Error(
    `Unexpected call to assertNever() with input: ${JSON.stringify(
      input,
      null /* replacer */,
      4 /* tabSize */
    )}`
  );
}
