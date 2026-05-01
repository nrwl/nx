import { nxVersion } from '../utils/versions';
import { getInstalledNxVersion } from '../utils/installed-nx-version';

export function isNxVersionMismatch(): boolean {
  return getInstalledNxVersion() !== nxVersion;
}
