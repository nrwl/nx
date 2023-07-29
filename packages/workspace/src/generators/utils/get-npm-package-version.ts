export function getNpmPackageVersion(
  packageName: string,
  packageVersion?: string
): string | null {
  try {
    const version = require('child_process').execSync(
      `npm view ${packageName}${
        packageVersion ? '@' + packageVersion : ''
      } version --json`,
      { stdio: ['pipe', 'pipe', 'ignore'] }
    );

    if (version) {
      // package@1.12 => ["1.12.0", "1.12.1"]
      // package@1.12.1 => "1.12.1"
      // package@latest => "1.12.1"
      const versionOrArray = JSON.parse(version.toString());

      if (typeof versionOrArray === 'string') {
        return versionOrArray;
      }
      return versionOrArray.pop();
    }
  } catch (err) {}
  return packageVersion ?? null;
}
