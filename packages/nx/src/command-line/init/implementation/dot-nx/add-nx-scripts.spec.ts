import { readFileSync } from 'fs';
import { sanitizeWrapperScript } from './add-nx-scripts';
import { join } from 'path';

describe('sanitizeWrapperScript', () => {
  it('should remove any comments starting with //#', () => {
    const stripped = sanitizeWrapperScript(`// should not be removed
//# internal should be removed
const variable = 3;`);
    expect(stripped).not.toContain('internal');
    expect(stripped).toContain('variable = 3;');
  });

  it('should remove eslint-disable comments', () => {
    const stripped = sanitizeWrapperScript(`// should not be removed
// eslint-disable-next-line no-restricted-modules
const variable = 3;`);
    expect(stripped).not.toContain('no-restricted-modules');
    expect(stripped).toContain('variable = 3;');
  });

  it('should remove empty comments', () => {
    const stripped = sanitizeWrapperScript(`test; //`);
    expect(stripped.length).toEqual(5);
  });

  // This test serves as a final sanity check to ensure that the contents of the
  // nxw.ts file are as expected. It will need to be updated if the contents of
  // nxw.ts change.
  //
  // NOTE: this doesn't match the written nxw in consumer repos as its still
  // typescript, but its close enough for a sanity check.
  it('should match expected contents', () => {
    const contents = readFileSync(join(__dirname, 'nxw.ts'), 'utf-8');
    const stripped = sanitizeWrapperScript(contents);
    expect(stripped).toMatchInlineSnapshot(`
      "// This file should be committed to your repository! It wraps Nx and ensures
      // that your local installation matches nx.json.
      //
      // You should not edit this file, as future updates to Nx may require changes to it.
      // See: https://nx.dev/recipes/installation/install-non-javascript for more info.

      const fs: typeof import('fs') = require('fs');
      const path: typeof import('path') = require('path');
      const cp: typeof import('child_process') = require('child_process');

      import type { NxJsonConfiguration } from '../../../../config/nx-json';
      import type { PackageJson } from '../../../../utils/package-json';

      const installationPath = path.join(__dirname, 'installation', 'package.json');

      function matchesCurrentNxInstall(
        currentInstallation: PackageJson,
        nxJson: NxJsonConfiguration
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
              nxJson.installation.version ||
            require(path.join(
              path.dirname(installationPath),
              'node_modules',
              'nx',
              'package.json'
            )).version !== nxJson.installation.version
          ) {
            return false;
          }
          for (const [plugin, desiredVersion] of getDesiredPluginVersions(nxJson)) {
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
              ...getDesiredPluginVersions(nxJson),
            },
          })
        );

        try {
          cp.execSync('npm i', {
            cwd: path.dirname(installationPath),
            stdio: 'inherit',
          });
        } catch (e) {
          // revert possible changes to the current installation
          fs.writeFileSync(installationPath, JSON.stringify(currentInstallation));
          // rethrow
          throw e;
        }
      }

      function getDesiredPluginVersions(nxJson: NxJsonConfiguration) {
        const packages: Record<string, string> = {};

        for (const [plugin, version] of Object.entries(
          nxJson?.installation?.plugins ?? {}
        )) {
          packages[plugin] = version;
        }

        for (const plugin of nxJson.plugins ?? []) {
          if (typeof plugin === 'object' && plugin.version) {
            packages[getPackageName(plugin.plugin)] = plugin.version;
          }
        }

        return Object.entries(packages);
      }

      function getPackageName(name: string) {
        if (name.startsWith('@')) {
          return name.split('/').slice(0, 2).join('/');
        }
        return name.split('/')[0];
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
          if (!matchesCurrentNxInstall(currentInstallation, nxJson)) {
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
          console.error(messageLines.join('\\n'));
          process.exit(1);
        }
      }

      if (!process.env.NX_WRAPPER_SKIP_INSTALL) {
        ensureUpToDateInstallation();
      }

      require('./installation/node_modules/nx/bin/nx');
      "
    `);
  });
});
