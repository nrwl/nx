import * as assert from 'node:assert';

let load: (<T>(modulePath: string | URL) => Promise<T>) | undefined;

export function loadEsmModule<T>(modulePath: string | URL): Promise<T> {
  load ??= new Function('modulePath', `return import(modulePath);`) as Exclude<
    typeof load,
    undefined
  >;

  return load(modulePath);
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
