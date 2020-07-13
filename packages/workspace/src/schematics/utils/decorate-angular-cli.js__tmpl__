/**
 * This file decorates the Angular CLI with the Nx CLI to enable features such as computation caching
 * and faster execution of tasks.
 *
 * It does this by:
 *
 * - Patching the Angular CLI to warn you in case you accidentally use the undecorated ng command.
 * - Symlinking the ng to nx command, so all commands run through the Nx CLI
 * - Updating the package.json postinstall script to give you control over this script
 *
 * The Nx CLI decorates the Angular CLI, so the Nx CLI is fully compatible with it.
 * Every command you run should work the same when using the Nx CLI, except faster.
 *
 * Because of symlinking you can still type `ng build/test/lint` in the terminal. The ng command, in this case,
 * will point to nx, which will perform optimizations before invoking ng. So the Angular CLI is always invoked.
 * The Nx CLI simply does some optimizations before invoking the Angular CLI.
 *
 * To opt out of this patch:
 * - Replace occurrences of nx with ng in your package.json
 * - Remove the script from your postinstall script in your package.json
 * - Delete and reinstall your node_modules
 */

const fs = require('fs');
const os = require('os');
const cp = require('child_process');
const isWindows = os.platform() === 'win32';
const { output } = require('@nrwl/workspace');

/**
 * Paths to files being patched
 */
const angularCLIInitPath = 'node_modules/@angular/cli/lib/cli/index.js';

/**
 * Patch index.js to warn you if you invoke the undecorated Angular CLI.
 */
function patchAngularCLI(initPath) {
  const angularCLIInit = fs.readFileSync(initPath, 'utf-8').toString();

  if (!angularCLIInit.includes('NX_CLI_SET')) {
    fs.writeFileSync(initPath, `
if (!process.env['NX_CLI_SET']) {
  const { output } = require('@nrwl/workspace');
  output.warn({ title: 'The Angular CLI was invoked instead of the Nx CLI. Use "npx ng [command]" or "nx [command]" instead.' });
}
${angularCLIInit}
    `);
  }
}

/**
 * Symlink of ng to nx, so you can keep using `ng build/test/lint` and still
 * invoke the Nx CLI and get the benefits of computation caching.
 */
function symlinkNgCLItoNxCLI() {
  try {
    const ngPath = './node_modules/.bin/ng';
    const nxPath = './node_modules/.bin/nx';
    if (isWindows) {
      /**
       * This is the most reliable way to create symlink-like behavior on Windows.
       * Such that it works in all shells and works with npx.
       */
      ['', '.cmd', '.ps1'].forEach(ext => {
        if (fs.existsSync(nxPath + ext)) fs.writeFileSync(ngPath + ext, fs.readFileSync(nxPath + ext));
      });
    } else {
      // If unix-based, symlink
      cp.execSync(`ln -sf ./nx ${ngPath}`);
    }
  }
  catch(e) {
    output.error({ title: 'Unable to create a symlink from the Angular CLI to the Nx CLI:' + e.message });
    throw e;
  }
}

try {
  symlinkNgCLItoNxCLI();
  patchAngularCLI(angularCLIInitPath);
  output.log({ title: 'Angular CLI has been decorated to enable computation caching.' });
} catch(e) {
  output.error({ title: 'Decoration of the Angular CLI did not complete successfully' });
}
