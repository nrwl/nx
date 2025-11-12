import {
  getInstalledPackageVersionInfo,
  type VersionInfo,
} from '../angular-version-utils.js';

let ngPackagrVersionInfo: VersionInfo | undefined;
export function getNgPackagrVersionInfo(): VersionInfo {
  if (!ngPackagrVersionInfo) {
    ngPackagrVersionInfo = getInstalledPackageVersionInfo('ng-packagr');
  }

  return ngPackagrVersionInfo;
}
