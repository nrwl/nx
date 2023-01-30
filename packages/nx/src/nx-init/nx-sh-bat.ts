// The contents of this file, once transpiled, are inlined into nx and nx.bat.
// As such, we cannot import anything from nx or other @nrwl packages. Node
// builtins only.

const fs: typeof import('fs') = require('fs');
const path: typeof import('path') = require('path');
const cp: typeof import('child_process') = require('child_process');

import type { NxJsonConfiguration } from '../config/nx-json';
import type { PackageJson } from '../utils/package-json';

const nxJsonPath = path.join(__dirname, 'nx.json');

let nxJson: NxJsonConfiguration;

try {
  nxJson = JSON.parse(fs.readFileSync(nxJsonPath, 'utf-8'));
} catch {
  // We should do something here.....
  // Should we assume they want latest?
  // Should we ask and then create an nx.json with the version?
  // Should we use latest and not store it?
}

const installationPath = path.join(
  __dirname,
  '.nx',
  'installation',
  'package.json'
);

try {
  ensureDir('.nx/installation');
  if (!matchesCurrentNxInstall(nxJson.installation)) {
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
    cp.execSync('npm i', {
      cwd: path.dirname(installationPath),
    });
  }
} catch {}

function matchesCurrentNxInstall(installation) {
  try {
    const currentInstallation: PackageJson = JSON.parse(
      fs.readFileSync(installationPath, 'utf-8')
    );
    if (
      currentInstallation.dependencies['nx'] !== installation.version ||
      JSON.parse(
        fs.readFileSync(
          path.join(installationPath, 'node_modules', 'nx', 'package.json'),
          'utf-8'
        )
      ).version !== installation.version
    ) {
      return false;
    }
    for (const plugin of installation.plugins || {}) {
      if (
        currentInstallation.dependencies[plugin] !==
        installation.plugins[plugin]
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function ensureDir(p) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}
