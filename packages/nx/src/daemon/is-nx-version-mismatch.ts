import { nxVersion } from '../utils/versions';
import { getInstalledNxVersion } from '../utils/installed-nx-version';

export { getInstalledNxVersion };

export function isNxVersionMismatch(): boolean {
  return getInstalledNxVersion() !== nxVersion;
}
