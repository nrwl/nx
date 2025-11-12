import {
  detectPackageManager,
  getPackageManagerCommand,
  output,
} from '@nx/devkit';
import { execSync } from 'child_process';
import { Schema } from './schema.js';

export function callUpgrade(schema: Schema): 1 | Buffer {
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

    execSync(
      `${pm.dlx} ${
        packageManager === 'yarn' ? 'storybook' : 'storybook@latest'
      } upgrade ${schema.autoAcceptAllPrompts ? '--yes' : ''}`,
      {
        stdio: [0, 1, 2],
        windowsHide: false,
      }
    );

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
    return 1;
  }
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
