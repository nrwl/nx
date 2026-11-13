import {
  detectPackageManager,
  getPackageManagerCommand,
  output,
  readJsonFile,
  workspaceRoot,
  writeJsonFile,
} from '@nx/devkit';
import { execSync } from 'child_process';
import { join } from 'path';
import { Schema } from './schema';

export function callUpgrade(schema: Schema): { success: boolean } {
  const packageManager = detectPackageManager();
  const pm = getPackageManagerCommand(packageManager);
  try {
    output.log({
      title: `Calling sb upgrade`,
      bodyLines: [
        `ℹ️ Nx will call the Storybook CLI to upgrade your @storybook/* packages to the latest version.`,
        `📖 You can read more about the Storybook upgrade command here: https://storybook.js.org/docs/react/configure/upgrading`,
      ],
      color: 'blue',
    });

    const nxVersions = readNxDependencyVersions();
    try {
      execSync(
        `${pm.dlx} ${
          packageManager === 'yarn' ? 'storybook' : 'storybook@latest'
        } upgrade ${schema.autoAcceptAllPrompts ? '--yes' : ''}`,
        {
          stdio: [0, 1, 2],
          windowsHide: true,
        }
      );
    } finally {
      // The CLI installed the versions it bumped, and Nx skips its own install
      // when the declarations end up unchanged, so reinstall here.
      if (restoreNxDependencyVersions(nxVersions)) {
        installRestoredNxVersions(pm.install);
      }
    }

    output.log({
      title: `Storybook packages upgraded.`,
      bodyLines: [
        `☑️ The upgrade command was successful.`,
        `Your Storybook packages are now at the latest version.`,
      ],
      color: 'green',
    });
  } catch (e) {
    output.log({
      title: 'Migration failed',
      bodyLines: [
        `🚨 The Storybook CLI failed to upgrade your @storybook/* packages to the latest version.`,
        `Please try running the sb upgrade command manually:`,
        `${pm.exec} storybook@latest upgrade`,
      ],
      color: 'red',
    });
    console.log(e);
    return { success: false };
  }
  return { success: true };
}

function installRestoredNxVersions(installCommand: string): void {
  try {
    execSync(installCommand, {
      cwd: workspaceRoot,
      stdio: [0, 1, 2],
      windowsHide: true,
    });
  } catch {
    output.warn({
      title: 'Failed to install the restored Nx package versions',
      bodyLines: [`Run "${installCommand}" to install them.`],
    });
  }
}

const dependencySections = ['dependencies', 'devDependencies'] as const;

function isNxPackage(name: string): boolean {
  return name === 'nx' || name.startsWith('@nx/');
}

function readNxDependencyVersions(): Record<string, Record<string, string>> {
  const packageJson = readJsonFile(join(workspaceRoot, 'package.json'));
  const versions: Record<string, Record<string, string>> = {};
  for (const section of dependencySections) {
    versions[section] = Object.fromEntries(
      Object.entries<string>(packageJson[section] ?? {}).filter(([name]) =>
        isNxPackage(name)
      )
    );
  }
  return versions;
}

function restoreNxDependencyVersions(
  versions: Record<string, Record<string, string>>
): boolean {
  const packageJsonPath = join(workspaceRoot, 'package.json');
  const packageJson = readJsonFile(packageJsonPath);
  let changed = false;
  for (const section of dependencySections) {
    for (const [name, version] of Object.entries(versions[section])) {
      if (packageJson[section]?.[name] !== version) {
        packageJson[section][name] = version;
        changed = true;
      }
    }
  }
  if (changed) {
    writeJsonFile(packageJsonPath, packageJson);
  }
  return changed;
}

export function checkStorybookInstalled(
  packageJson: Record<string, any>
): boolean {
  return (
    (packageJson.dependencies['storybook'] ||
      packageJson.devDependencies['storybook']) &&
    (packageJson.dependencies['@nx/storybook'] ||
      packageJson.devDependencies['@nx/storybook'])
  );
}
