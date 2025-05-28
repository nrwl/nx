export function assertBuilderPackageIsInstalled(packageName: string): void {
  try {
    require.resolve(packageName);
  } catch {
    throw new Error(
      `This executor requires the package ${packageName} to be installed. Please make sure it is installed and try again.`
    );
  }
}
