export function assertBuilderPackageIsInstalled(packageName: string): void {
  try {
    require(packageName);
  } catch {
    throw new Error(
      `The required package ${packageName} is not installed. Please make sure it is installed and try again.`
    );
  }
}
