import {
  getInstalledPackageVersionInfo,
  type VersionInfo,
} from '../angular-version-utils';

let ngPackagrVersionInfo: VersionInfo | undefined;
export function getNgPackagrVersionInfo(): VersionInfo {
  if (!ngPackagrVersionInfo) {
    const versionInfo = getInstalledPackageVersionInfo('ng-packagr');
    if (!versionInfo) {
      throw new Error('Could not find the installed version of "ng-packagr".');
    }
    ngPackagrVersionInfo = versionInfo;
  }

  return ngPackagrVersionInfo;
}
