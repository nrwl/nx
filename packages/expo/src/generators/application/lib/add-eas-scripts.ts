import type { Tree } from '@nx/devkit';

export const easBuildPreInstallScriptPath =
  'tools/scripts/eas-build-pre-install.mjs';
export const easBuildPostInstallScriptPath =
  'tools/scripts/eas-build-post-install.mjs';

const preInstallScript = `
/**
 * This script prepares an Expo app for EAS Build in a workspace without package manager workspaces.
 * It is run as a eas-build-pre-install script in the 'package.json' of expo app.
 * It is executed as 'node tools/scripts/eas-build-pre-install.mjs <workspace root> <project root>'
 * It copies the root dependencies, overrides or resolutions, and lock file into the project,
 * so EAS installs the versions pinned at the workspace root.
 */

import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const [workspaceRoot, projectRoot] = process.argv.slice(2);

const lockFiles = {
  bun: ['bun.lock', 'bun.lockb'],
  yarn: ['yarn.lock'],
  pnpm: ['pnpm-lock.yaml'],
  npm: ['package-lock.json'],
};

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function detectPackageManager() {
  const nxJsonPath = join(workspaceRoot, 'nx.json');
  const configured = existsSync(nxJsonPath)
    ? readJson(nxJsonPath).cli?.packageManager
    : undefined;
  if (configured) {
    return configured;
  }
  for (const [packageManager, files] of Object.entries(lockFiles)) {
    if (files.some((file) => existsSync(join(workspaceRoot, file)))) {
      return packageManager;
    }
  }
  return 'npm';
}

function isWorkspacesEnabled(packageManager, rootPackageJson) {
  if (packageManager === 'pnpm') {
    const pnpmWorkspacePath = join(workspaceRoot, 'pnpm-workspace.yaml');
    return (
      existsSync(pnpmWorkspacePath) &&
      /^["']?packages["']?\\s*:/m.test(readFileSync(pnpmWorkspacePath, 'utf-8'))
    );
  }
  return !!rootPackageJson.workspaces;
}

const packageManager = detectPackageManager();
const rootPackageJson = readJson(join(workspaceRoot, 'package.json'));

if (isWorkspacesEnabled(packageManager, rootPackageJson)) {
  console.log('Package manager workspaces are enabled, nothing to copy');
  process.exit(0);
}

const projectPackageJsonPath = join(projectRoot, 'package.json');
const projectPackageJson = readJson(projectPackageJsonPath);
projectPackageJson.dependencies = rootPackageJson.dependencies;
projectPackageJson.devDependencies = rootPackageJson.devDependencies;
if (rootPackageJson.overrides) {
  projectPackageJson.overrides = rootPackageJson.overrides;
} else if (rootPackageJson.resolutions) {
  projectPackageJson.resolutions = rootPackageJson.resolutions;
}
// EAS installs with a frozen lock file, and pnpm records its settings in the lock file.
if (rootPackageJson.pnpm) {
  projectPackageJson.pnpm = rootPackageJson.pnpm;
}
// Yarn Berry keys the root workspace by name in the lock file.
if (packageManager === 'yarn') {
  projectPackageJson.name = rootPackageJson.name;
}
writeFileSync(projectPackageJsonPath, JSON.stringify(projectPackageJson, null, 2));

const lockFile = Object.hasOwn(lockFiles, packageManager)
  ? lockFiles[packageManager].find((file) =>
      existsSync(join(workspaceRoot, file))
    )
  : undefined;
if (lockFile) {
  copyFileSync(join(workspaceRoot, lockFile), join(projectRoot, lockFile));
  console.log(\`Copied root dependencies and \${lockFile} into \${projectRoot}\`);
} else {
  console.log(\`Copied root dependencies into \${projectRoot}, no lock file found\`);
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

export function addEasBuildPreInstallScript(tree: Tree) {
  if (!tree.exists(easBuildPreInstallScriptPath)) {
    tree.write(easBuildPreInstallScriptPath, preInstallScript);
  }
}

export function addEasScripts(tree: Tree) {
  addEasBuildPreInstallScript(tree);
  if (!tree.exists(easBuildPostInstallScriptPath)) {
    tree.write(easBuildPostInstallScriptPath, postInstallScript);
  }
}
