// Valid npm package names: optional @scope/ prefix, then URL-safe chars (A-Za-z0-9 . - _ ~)
// Must not start with . or _ per npm rules. Uppercase allowed for legacy packages.
const validNpmPackageNameRegex =
  /^(@[a-zA-Z0-9~-][a-zA-Z0-9._~-]*\/)?[a-zA-Z0-9~-][a-zA-Z0-9._~-]*$/;

export function getNpmPackageVersion(
  packageName: string,
  packageVersion?: string
): string | null {
  if (!validNpmPackageNameRegex.test(packageName)) {
    throw new Error(
      `Invalid npm package name: "${packageName}". Package names can only contain URL-safe characters (letters, digits, hyphens, dots, underscores, and tildes).`
    );
  }

  try {
    const packageSpec = packageVersion
      ? `${packageName}@${packageVersion}`
      : packageName;
    // Use npm.cmd on Windows since execFileSync without a shell can't run .cmd files
    const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const version = require('child_process').execFileSync(
      npmBin,
      ['view', packageSpec, 'version', '--json'],
      {
        stdio: ['pipe', 'pipe', 'ignore'],
        windowsHide: false,
      }
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
