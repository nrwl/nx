import {
  hasNxJson,
  readNxJson,
  type NxJsonConfiguration,
} from '../../config/nx-json';

import { readFileSync, statSync } from 'node:fs';

import { isCI } from '../../utils/is-ci';
import { workspaceRoot } from '../../utils/workspace-root';
import { isDaemonDisabled } from '../tmp-dir';

let _enabled: boolean | undefined;

export function isDaemonEnabled(nxJson: NxJsonConfiguration = readNxJson()) {
  if (_enabled === undefined) {
    const useDaemonProcessOption = nxJson?.useDaemonProcess;
    const env = process.env.NX_DAEMON;

    // env takes precedence
    // option=true,env=false => no daemon
    // option=false,env=undefined => no daemon
    // option=false,env=false => no daemon

    // option=undefined,env=undefined => daemon
    // option=true,env=true => daemon
    // option=false,env=true => daemon

    // CI=true,env=undefined => no daemon
    // CI=true,env=false => no daemon
    // CI=true,env=true => daemon

    // docker=true,env=undefined => no daemon
    // docker=true,env=false => no daemon
    // docker=true,env=true => daemon
    // WASM => no daemon because file watching does not work
    if (
      ((isCI() || isDocker()) && env !== 'true') ||
      isDaemonDisabled() ||
      nxJsonIsNotPresent() ||
      (useDaemonProcessOption === undefined && env === 'false') ||
      (useDaemonProcessOption === true && env === 'false') ||
      (useDaemonProcessOption === false && env === undefined) ||
      (useDaemonProcessOption === false && env === 'false')
    ) {
      _enabled = false;
    } else if (
      (require('../../native') as typeof import('../../native')).IS_WASM
    ) {
      (
        require('../../utils/output') as typeof import('../../utils/output')
      ).output.warn({
        title:
          'The Nx Daemon is unsupported in WebAssembly environments. Some things may be slower than or not function as expected.',
      });
      _enabled = false;
    } else {
      _enabled = true;
    }
  }
  return _enabled;
}

function isDocker() {
  try {
    statSync('/.dockerenv');
    return true;
  } catch {
    try {
      return readFileSync('/proc/self/cgroup', 'utf8')?.includes('docker');
    } catch {}

    return false;
  }
}

function nxJsonIsNotPresent() {
  return !hasNxJson(workspaceRoot);
}
