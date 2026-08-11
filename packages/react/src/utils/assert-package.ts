export function assertPackageIsInstalled(
  packageName: string,
  requiredBy: string
): void {
  try {
    require.resolve(packageName);
  } catch (e) {
    // Only a missing module means "not installed"; surface other resolution
    // errors (e.g. a malformed package's exports) as-is instead of mislabeling.
    const code = (e as NodeJS.ErrnoException).code;
    if (code !== 'MODULE_NOT_FOUND' && code !== 'ERR_MODULE_NOT_FOUND') {
      throw e;
    }
    throw new Error(
      `The "${packageName}" package is required by "${requiredBy}" but is not installed. Please install it and try again.`
    );
  }
}
