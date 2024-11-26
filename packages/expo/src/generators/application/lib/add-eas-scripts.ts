import type { Tree } from '@nx/devkit';

const postInstallScript = `
/**
 * This script is used to patch the '@nx/expo' package to work with EAS Build.
 * It is run as a eas-build-post-install script in the 'package.json' of expo app.
 * It is executed as 'node tools/scripts/eas-build-post-install.mjs <workspace root> <project root>'
 * It will create a symlink from the project's node_modules to the workspace's node_modules.
 */

import { symlink, existsSync } from 'fs';
import { join } from 'path';

const [workspaceRoot, projectRoot] = process.argv.slice(2);

if (existsSync(join(workspaceRoot, 'node_modules'))) {
  console.log('Symlink already exists');
  process.exit(0);
}

symlink(join(projectRoot, 'node_modules'), join(workspaceRoot, 'node_modules'), 'dir', (err) => {
  if (err) console.log(err);
  else {
    console.log('Symlink created');
  }
});
`;

export function addEasScripts(tree: Tree) {
  const postInstallScriptPath = 'tools/scripts/eas-build-post-install.mjs';

  if (!tree.exists(postInstallScriptPath)) {
    tree.write(postInstallScriptPath, postInstallScript);
  }
}
