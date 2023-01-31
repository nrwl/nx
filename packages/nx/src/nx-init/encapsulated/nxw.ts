// The contents of this file, once transpiled, are inlined into nx and nx.bat.
// As such, we cannot import anything from nx or other @nrwl packages. Node
// builtins only.

const fs: typeof import('fs') = require('fs');
const path: typeof import('path') = require('path');
const cp: typeof import('child_process') = require('child_process');

import type { NxJsonConfiguration } from '../../config/nx-json';
import type { PackageJson } from '../../utils/package-json';

const installationPath = path.join(__dirname, 'installation', 'package.json');

function matchesCurrentNxInstall(
  nxJsonInstallation: NxJsonConfiguration['installation']
) {
  try {
    const currentInstallation: PackageJson = JSON.parse(
      fs.readFileSync(installationPath, 'utf-8')
    );
    if (
      currentInstallation.dependencies['nx'] !== nxJsonInstallation.version ||
      JSON.parse(
        fs.readFileSync(
          path.join(installationPath, 'node_modules', 'nx', 'package.json'),
          'utf-8'
        )
      ).version !== nxJsonInstallation.version
    ) {
      return false;
    }
    for (const [plugin, desiredVersion] of Object.entries(
      nxJsonInstallation.plugins || {}
    )) {
      if (currentInstallation.dependencies[plugin] !== desiredVersion) {
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

function ensureUpToDateInstallation() {
  const nxJsonPath = path.join(__dirname, '..', 'nx.json');

  let nxJson: NxJsonConfiguration;

  try {
    nxJson = JSON.parse(fs.readFileSync(nxJsonPath, 'utf-8'));
  } catch {
    console.error(
      '[NX]: nx.json is required when running in encapsulated mode. Run `npx nx init --encapuslated` to restore it.'
    );
    process.exit(1);
  }

  try {
    ensureDir(path.join(__dirname, 'installation'));
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
}

if (require.main === module) {
  ensureUpToDateInstallation();
  require('./installation/node_modules/nx/bin/nx');
}
