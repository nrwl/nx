import {
  GeneratorCallback,
  Tree,
  getProjects,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  updateProjectConfiguration,
} from '@nx/devkit';
import { output } from 'nx/src/utils/output';
import migrate7Generator from '@nx/storybook/src/generators/migrate-7/migrate-7';
import { storybookMajorVersion } from '@nx/storybook/src/utils/utilities';
import storybookConfigurationGenerator from '@nx/react/src/generators/storybook-configuration/configuration';

/**
 * Upgrade react native storybook target to use web
 */
export default async function changeStorybookTargets(tree: Tree) {
  const tasks: GeneratorCallback[] = [];

  // update the storybook target
  const projects = getProjects(tree);
  let hasStorybookTarget = false;
  for (const [projectName, config] of projects.entries()) {
    if (
      config.targets?.['storybook']?.executor === '@nx/react-native:storybook'
    ) {
      hasStorybookTarget = true;

      delete config.targets['storybook'];
      updateProjectConfiguration(tree, projectName, config);

      tasks.push(
        await storybookConfigurationGenerator(tree, {
          project: projectName,
        })
      );
    }
  }

  /**
   * This just checks if Storybook is installed in the workspace.
   * The thing here is that during the previous step of the migration,
   * during packageJsonUpdates, Nx has already set Storybook
   * to version 7, if Storybook exists in the workspace.
   * So, it makes no sense here to check if the version is
   * 7, because it will always be.
   */
  const storybookVersion = storybookMajorVersion();
  if (!hasStorybookTarget || !storybookVersion) {
    return;
  }
  output.log({
    title: 'Migrating Storybook to v7',
    bodyLines: [
      `🚀 This migration will update your Storybook configuration to v7.`,
      `It will call the @nx/storybook:migrate-7 generator for you.`,
      `You can read more about the migration and how this generator works here:`,
      `https://nx.dev/nx-api/storybook/generators/migrate-7`,
    ],
  });
  tasks.push(await migrate7Generator(tree, { autoAcceptAllPrompts: true }));
  tasks.push(
    removeDependenciesFromPackageJson(
      tree,
      [],
      [
        '@storybook/react-native',
        '@storybook/addon-ondevice-actions',
        '@storybook/addon-ondevice-backgrounds',
        '@storybook/addon-ondevice-controls',
        '@storybook/addon-ondevice-notes',
      ]
    )
  );

  return runTasksInSerial(...tasks);
}
