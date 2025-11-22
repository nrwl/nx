import { readJsonFile } from '../utils/fileutils';
import type { PackageJson } from '../utils/package-json';
import { nxVersion } from '../utils/versions';
import { workspaceRoot } from '../utils/workspace-root';

export function getInstalledNxVersion(): string | null {
  try {
    const nxPackageJsonPath = require.resolve('nx/package.json', {
      paths: [workspaceRoot],
    });
    const { version } = readJsonFile<PackageJson>(nxPackageJsonPath);
    return version;
  } catch {
    // node modules are absent
    return null;
  }
}

export function isNxVersionMismatch(): boolean {
  return getInstalledNxVersion() !== nxVersion;
}
