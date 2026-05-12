/**
 * Throws a standardized error when a third-party package is installed at a
 * version below a plugin's supported floor.
 *
 * Use this at every site where a plugin determines the installed version of a
 * supported third-party package is below its declared floor, so the message is
 * consistent across plugins.
 *
 * @param packageName Name of the third-party package (e.g. `@angular/core`).
 * @param installedVersion Version detected in the workspace (e.g. `18.2.0`).
 * @param floor Lowest version the plugin supports (e.g. `19.0.0`).
 */
export function throwForUnsupportedVersion(
  packageName: string,
  installedVersion: string,
  floor: string
): never {
  throw new Error(
    `Unsupported version of \`${packageName}\` detected.\n\n` +
      `  Installed: ${installedVersion}\n` +
      `  Supported: >= ${floor}\n\n` +
      `Update \`${packageName}\` to ${floor} or higher.`
  );
}
