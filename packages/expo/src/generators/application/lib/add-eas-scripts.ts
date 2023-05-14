import type { Tree } from '@nx/devkit';

const preInstallScript = `
/*
 * This script is used to patch the '@nx/expo' package to work with EAS Build.
 * It is run as the eas-build-pre-install script in the 'package.json' of expo app.
 * It is executed as 'node tools/scripts/eas-build-pre-install.mjs <workspace root> <project root>'
 * It will copy the dependencies and devDependencies from the workspace package.json to project's package.json.
 * This is needed because EAS Build does the install in project's directory and not workspace's directory.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const [workspaceRoot, projectRoot] = process.argv.slice(2);
if (!workspaceRoot) {
  throw new Error('Missing workspace root');
}
if (!projectRoot) {
  throw new Error('Missing project root');
}
try {
  const workspacePackage = JSON.parse(
    readFileSync(join(workspaceRoot, 'package.json')).toString()
  );
  const projectPackage = JSON.parse(
    readFileSync(join(projectRoot, 'package.json')).toString()
  );
  projectPackage.dependencies = workspacePackage.dependencies;
  projectPackage.devDependencies = workspacePackage.devDependencies;
  writeFileSync(
    join(projectRoot, 'package.json'),
    JSON.stringify(projectPackage, null, 2)
  );
} catch (e) {
  console.error('Error reading package.json file', e);
}
`;

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
  const preInstallScriptPath = 'tools/scripts/eas-build-pre-install.mjs';
  const postInstallScriptPath = 'tools/scripts/eas-build-post-install.mjs';

  if (!tree.exists(preInstallScriptPath)) {
    tree.write(preInstallScriptPath, preInstallScript);
  }
  if (!tree.exists(postInstallScriptPath)) {
    tree.write(postInstallScriptPath, postInstallScript);
  }
}
