export function assertPackageIsInstalled(
  packageName: string,
  requiredBy: string
): void {
  try {
    require.resolve(packageName);
  } catch {
    throw new Error(
      `The "${packageName}" package is required by "${requiredBy}" but is not installed. Please install it and try again.`
    );
  }
}
