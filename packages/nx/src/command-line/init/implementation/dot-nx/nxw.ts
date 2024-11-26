// This file should be committed to your repository! It wraps Nx and ensures
// that your local installation matches nx.json.
// See: https://nx.dev/recipes/installation/install-non-javascript for more info.
//
//# The contents of this file are executed before packages are installed.
//# As such, we should not import anything from nx, other @nrwl packages,
//# or any other npm packages. Only import node builtins. Type Imports are
//# fine, since they are removed by the typescript compiler.

const fs: typeof import('fs') = require('fs');
const path: typeof import('path') = require('path');
const cp: typeof import('child_process') = require('child_process');

import type { NxJsonConfiguration } from '../../../../config/nx-json';
import type { PackageJson } from '../../../../utils/package-json';

const installationPath = path.join(__dirname, 'installation', 'package.json');

function matchesCurrentNxInstall(
  currentInstallation: PackageJson,
  nxJsonInstallation: NxJsonConfiguration['installation']
) {
  if (
    !currentInstallation.devDependencies ||
    !Object.keys(currentInstallation.devDependencies).length
  ) {
    return false;
  }

  try {
    if (
      currentInstallation.devDependencies['nx'] !==
        nxJsonInstallation.version ||
      require(path.join(
        path.dirname(installationPath),
        'node_modules',
        'nx',
        'package.json'
      )).version !== nxJsonInstallation.version
    ) {
      return false;
    }
    for (const [plugin, desiredVersion] of Object.entries(
      nxJsonInstallation.plugins || {}
    )) {
      if (currentInstallation.devDependencies[plugin] !== desiredVersion) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

function getCurrentInstallation(): PackageJson {
  try {
    return require(installationPath);
  } catch {
    return {
      name: 'nx-installation',
      version: '0.0.0',
      devDependencies: {},
    };
  }
}

function performInstallation(
  currentInstallation: PackageJson,
  nxJson: NxJsonConfiguration
) {
  fs.writeFileSync(
    installationPath,
    JSON.stringify({
      name: 'nx-installation',
      devDependencies: {
        nx: nxJson.installation.version,
        ...nxJson.installation.plugins,
      },
    })
  );

  try {
    cp.execSync('npm i', {
      cwd: path.dirname(installationPath),
      stdio: 'inherit',
      windowsHide: true,
    });
  } catch (e) {
    // revert possible changes to the current installation
    fs.writeFileSync(installationPath, JSON.stringify(currentInstallation));
    // rethrow
    throw e;
  }
}

function ensureUpToDateInstallation() {
  const nxJsonPath = path.join(__dirname, '..', 'nx.json');
  let nxJson: NxJsonConfiguration;

  try {
    nxJson = require(nxJsonPath);
    if (!nxJson.installation) {
      console.error(
        '[NX]: The "installation" entry in the "nx.json" file is required when running the nx wrapper. See https://nx.dev/recipes/installation/install-non-javascript'
      );
      process.exit(1);
    }
  } catch {
    console.error(
      '[NX]: The "nx.json" file is required when running the nx wrapper. See https://nx.dev/recipes/installation/install-non-javascript'
    );
    process.exit(1);
  }

  try {
    ensureDir(path.join(__dirname, 'installation'));
    const currentInstallation = getCurrentInstallation();
    if (!matchesCurrentNxInstall(currentInstallation, nxJson.installation)) {
      performInstallation(currentInstallation, nxJson);
    }
  } catch (e: unknown) {
    const messageLines = [
      '[NX]: Nx wrapper failed to synchronize installation.',
    ];
    if (e instanceof Error) {
      messageLines.push('');
      messageLines.push(e.message);
      messageLines.push(e.stack);
    } else {
      messageLines.push(e.toString());
    }
    console.error(messageLines.join('\n'));
    process.exit(1);
  }
}

if (!process.env.NX_WRAPPER_SKIP_INSTALL) {
  ensureUpToDateInstallation();
}
// eslint-disable-next-line no-restricted-modules
require('./installation/node_modules/nx/bin/nx');
