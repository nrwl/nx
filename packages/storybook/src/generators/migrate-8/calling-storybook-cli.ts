import {
  detectPackageManager,
  getPackageManagerCommand,
  output,
} from '@nx/devkit';
import { execSync } from 'child_process';
import { Schema } from './schema';

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
        `${pm.exec} ${
          packageManager === 'yarn' ? 'storybook' : 'storybook@latest'
        } upgrade`,
      ],
      color: 'red',
    });
    console.log(e);
    return 1;
  }
}

export function callAutomigrate(
  allStorybookProjects: {
    [key: string]: {
      configDir: string;
    };
  },
  schema: Schema
): { successfulProjects: {}; failedProjects: {} } {
  output.log({
    title: `⚙️ Calling sb automigrate`,
    bodyLines: [
      `ℹ️  Nx will call the Storybook CLI to automigrate the Storybook configuration of all your projects that use Storybook.`,
      `📖 You can read more about the Storybook automigrate command here: https://storybook.js.org/docs/react/configure/upgrading#automigrate-script`,
    ],
    color: 'green',
  });

  const resultOfMigration = {
    successfulProjects: {},
    failedProjects: {},
  };

  Object.entries(allStorybookProjects).forEach(
    ([projectName, storybookProjectInfo]) => {
      const packageManager = detectPackageManager();
      const pm = getPackageManagerCommand(packageManager);
      const commandToRun = `${pm.dlx} ${
        packageManager === 'yarn' ? 'storybook' : 'storybook@latest'
      } automigrate --config-dir ${storybookProjectInfo.configDir}`;
      try {
        output.log({
          title: `Calling sb automigrate for ${projectName}`,
          bodyLines: ['Command:', commandToRun],
          color: 'green',
        });

        execSync(
          `${commandToRun}  ${schema.autoAcceptAllPrompts ? '--yes' : ''}`,
          {
            stdio: 'inherit',
            windowsHide: false,
          }
        );

        resultOfMigration.successfulProjects[projectName] = commandToRun;
      } catch (e) {
        output.error({
          title: 'Migration failed',
          bodyLines: [
            `🚨 The Storybook CLI failed to automigrate the Storybook configuration of your project.`,
            `The error was: ${e}`,
            `Please try running the sb automigrate command manually:`,
            commandToRun,
          ],
        });
        resultOfMigration.failedProjects[projectName] = commandToRun;
      }
    }
  );

  return resultOfMigration;
}
