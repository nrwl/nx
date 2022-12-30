export function getNpmPackageVersion(packageName: string): string | null {
  try {
    const version = require('child_process').execSync(
      `npm view ${packageName} version`,
      { stdio: ['pipe', 'pipe', 'ignore'] }
    );

    if (version) {
      return version
        .toString()
        .trim()
        .replace(/^\n*|\n*$/g, '');
    }
  } catch (err) {}
  return null;
}
